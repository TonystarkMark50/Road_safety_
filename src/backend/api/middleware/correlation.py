from __future__ import annotations

import logging
import uuid
from typing import Callable

logger = logging.getLogger(__name__)


class CorrelationIdMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        incoming = headers.get(b"x-request-id", b"").decode() or headers.get(b"x-correlation-id", b"").decode()
        correlation_id = incoming or uuid.uuid4().hex[:16]

        async def send_with_id(message):
            if message["type"] == "http.response.start":
                hdrs = list(message.get("headers", []))
                hdrs.append((b"x-request-id", correlation_id.encode()))
                message["headers"] = hdrs
            await send(message)

        scope = dict(scope)
        scope["state"] = dict(scope.get("state", {}))
        scope["state"]["correlation_id"] = correlation_id
        await self.app(scope, receive, send_with_id)
