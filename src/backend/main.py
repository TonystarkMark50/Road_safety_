from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from src.backend.core.config import settings
from src.backend.api.middleware.error_handler import setup_error_handlers
from src.backend.api.middleware.security import SecurityMiddleware, rate_limiter
from src.backend.api.middleware.correlation import CorrelationIdMiddleware
from src.backend.infrastructure.database.supabase_client import verify_schema_tables
from src.backend.api.routes import (
    administration as admin,
    authentication as auth,
    chat,
    configuration,
    emergency,
    map_data,
    media,
    notifications,
    reports,
    users,
    ai_stream,
    profile,
    roles,
    audit,
    government_auth as gov_auth,
    mfa,
    sessions,
)
from src.backend.api.ws.connection_manager import handle_websocket, manager

logger = logging.getLogger(__name__)


def _init_sentry() -> None:
    if not settings.SENTRY_DSN:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            traces_sample_rate=0.1 if settings.APP_ENV == "production" else 0.0,
            integrations=[FastApiIntegration()],
        )
    except Exception as exc:
        logger.warning("Sentry init failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    _init_sentry()
    logger.info("Starting %s v%s [%s]", settings.APP_NAME, settings.APP_VERSION, settings.APP_ENV)

    # Validate database schema at startup
    required_tables = [
        "users", "reports", "notifications", "audit_log",
        "chat_conversations", "chat_messages", "role_change_requests",
        "user_sessions", "activity_log", "government_requests",
        "emergency_services", "infrastructure", "budget_items",
        "traffic_analytics", "mfa_devices", "login_attempts",
    ]
    missing = verify_schema_tables(required_tables)
    if missing:
        logger.warning(
            "Tables missing from schema cache (will retry on access): %s",
            ", ".join(missing),
        )
    else:
        logger.info("All %d required tables verified in schema", len(required_tables))

    yield
    rate_limiter.stop()
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        lifespan=lifespan,
        docs_url="/docs" if settings.APP_ENV != "production" else None,
        redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    )

    if settings.APP_ENV == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS,
        )

    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Bootstrap-Admin-Token"],
    )

    app.add_middleware(SecurityMiddleware, rate_limiter=rate_limiter)

    setup_error_handlers(app)

    @app.get("/health")
    async def health_check() -> dict:
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
        }

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(reports.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(notifications.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(media.router, prefix="/api/v1")
    app.include_router(configuration.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")
    app.include_router(emergency.router, prefix="/api/v1")
    app.include_router(map_data.router, prefix="/api/v1")
    app.include_router(ai_stream.router, prefix="/api/v1")
    app.include_router(profile.router, prefix="/api/v1")
    app.include_router(roles.router, prefix="/api/v1")
    app.include_router(audit.router, prefix="/api/v1")
    app.include_router(gov_auth.router, prefix="/api/v1")
    app.include_router(mfa.router, prefix="/api/v1")
    app.include_router(sessions.router, prefix="/api/v1")

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await handle_websocket(websocket)

    @app.get("/ws/health")
    async def ws_health():
        return await manager.health_check()

    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    if frontend_dir.exists():
        app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")

    @app.exception_handler(StarletteHTTPException)
    async def not_found_handler(request, exc):
        if exc.status_code == 404 and frontend_dir.exists():
            path = request.url.path
            # API routes should return JSON errors
            if path.startswith("/api/") or path.startswith("/ws/"):
                from starlette.responses import JSONResponse
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Not found"},
                )
            # For page routes, try 404.html, then index.html
            not_found_page = frontend_dir / "pages" / "404.html"
            if not_found_page.exists():
                return FileResponse(str(not_found_page), status_code=404)
            index = frontend_dir / "index.html"
            if index.exists():
                return FileResponse(str(index))
        from starlette.responses import JSONResponse
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    return app


app = create_app()
