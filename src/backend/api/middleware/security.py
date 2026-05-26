from __future__ import annotations

import re
import time
import threading
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
from src.backend.core.constants import CSP_HEADER, RATE_LIMIT_PATTERNS, SECURITY_HEADERS


class TokenBucket:
    def __init__(self, rate: int, window: int) -> None:
        self.rate = rate
        self.window = window
        self.tokens: Dict[str, list] = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> Tuple[bool, int]:
        now = time.monotonic()
        with self._lock:
            timestamps = self.tokens[key]
            cutoff = now - self.window
            timestamps[:] = [t for t in timestamps if t > cutoff]
            if len(timestamps) >= self.rate:
                retry_after = int(timestamps[0] + self.window - now)
                return False, max(retry_after, 1)
            timestamps.append(now)
            return True, 0

    def cleanup(self, max_age: int = 3600) -> None:
        now = time.monotonic()
        cutoff = now - max_age
        with self._lock:
            stale = [k for k, v in self.tokens.items() if v and v[-1] < cutoff]
            for k in stale:
                del self.tokens[k]


class RateLimiter:
    def __init__(self) -> None:
        self.buckets: Dict[str, TokenBucket] = {}
        self.compiled: List[Tuple[re.Pattern, str]] = []
        for pattern, rate, window in RATE_LIMIT_PATTERNS:
            self.compiled.append((re.compile(pattern), pattern))
            self.buckets[pattern] = TokenBucket(rate, window)
        self._cleanup_thread: Optional[threading.Thread] = None
        self._stop_cleanup = threading.Event()
        self._start_cleanup()

    def _start_cleanup(self) -> None:
        def _run() -> None:
            while not self._stop_cleanup.wait(300):
                for bucket in self.buckets.values():
                    bucket.cleanup()

        self._cleanup_thread = threading.Thread(target=_run, daemon=True)
        self._cleanup_thread.start()

    def stop(self) -> None:
        self._stop_cleanup.set()

    def _match_bucket(self, path: str) -> Tuple[Optional[TokenBucket], str]:
        for pattern, key in self.compiled:
            if pattern.match(path):
                return self.buckets[key], key
        return None, ""

    def check(self, path: str, client_ip: str = "unknown") -> Tuple[bool, int]:
        bucket, pattern_key = self._match_bucket(path)
        if bucket is None:
            return True, 0
        rate_key = f"{client_ip}:{pattern_key}"
        return bucket.is_allowed(rate_key)

    def check_key(self, key: str, rate: int, window: int) -> Tuple[bool, int]:
        bucket_key = f"named:{rate}:{window}:{key}"
        if bucket_key not in self.buckets:
            self.buckets[bucket_key] = TokenBucket(rate, window)
        return self.buckets[bucket_key].is_allowed(key)

    def is_allowed(self, path: str, client_ip: str = "unknown") -> bool:
        allowed, _ = self.check(path, client_ip)
        return allowed


rate_limiter = RateLimiter()


class SecurityMiddleware:
    def __init__(self, app, rate_limiter: RateLimiter):
        self.app = app
        self.rate_limiter = rate_limiter

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        client = scope.get("client")
        client_ip = client[0] if client else "unknown"
        allowed, retry_after = self.rate_limiter.check(path, client_ip)
        if not allowed:
            headers = [
                (b"content-type", b"application/json"),
                (b"retry-after", str(retry_after).encode()),
            ]
            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": headers,
            })
            await send({
                "type": "http.response.body",
                "body": b'{"detail":"Rate limit exceeded"}',
            })
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                for name, value in SECURITY_HEADERS.items():
                    key = name.lower().encode()
                    if key not in headers:
                        headers[key] = value.encode()
                headers[b"content-security-policy"] = CSP_HEADER.encode()
                message["headers"] = list(headers.items())
            await send(message)

        await self.app(scope, receive, send_with_headers)
