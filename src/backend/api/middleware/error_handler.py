from __future__ import annotations

import logging
from typing import Callable, Union
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from src.backend.domain.exceptions import AppException

logger = logging.getLogger(__name__)


def setup_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        logger.warning(
            "AppException: status=%d code=%s message=%s",
            exc.status_code,
            exc.code,
            exc.message,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        exc_name = type(exc).__name__
        exc_str = str(exc)

        # Catch raw PostgREST errors and sanitize them
        if "PGRST" in exc_str or "postgrest" in exc_name.lower():
            logger.error("PostgREST API error: %s", exc_str)
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Database temporarily unavailable. Please try again.",
                    "code": "database_error",
                },
            )

        # Supabase Auth API errors (sign-up, login, etc.)
        if exc_name == "AuthApiError":
            message = exc_str or "Authentication request failed"
            status_code = 400
            if "rate limit" in message.lower():
                status_code = 429
            elif "already" in message.lower() or "registered" in message.lower():
                status_code = 409
            logger.warning("Auth API error: %s", message)
            return JSONResponse(
                status_code=status_code,
                content={"detail": message, "code": "auth_error"},
            )

        # Other Supabase client errors
        if "supabase" in exc_name.lower():
            logger.error("Supabase client error: %s", exc_str)
            return JSONResponse(
                status_code=502,
                content={
                    "detail": "Authentication service temporarily unavailable.",
                    "code": "auth_service_error",
                },
            )

        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An unexpected error occurred",
                "code": "internal_error",
            },
        )
