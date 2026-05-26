from __future__ import annotations

from typing import Callable

from fastapi import HTTPException, Request

from src.backend.api.middleware.security import rate_limiter
from src.backend.core.constants import NAMED_RATE_LIMITS


def rate_limit(limit_key: str = "default") -> Callable:
    async def _rate_limit(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        rate, window = NAMED_RATE_LIMITS.get(limit_key, NAMED_RATE_LIMITS["default"])
        allowed, retry_after = rate_limiter.check_key(f"{limit_key}:{client_ip}", rate, window)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(retry_after)},
            )
    return _rate_limit
