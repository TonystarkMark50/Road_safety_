from __future__ import annotations

import logging
import threading
import time
from typing import TYPE_CHECKING, Optional

from src.backend.core.config import settings
from src.backend.domain.exceptions import AppException

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)

_supabase_instance: Optional[Client] = None
_supabase_admin_instance: Optional[Client] = None
_lock = threading.Lock()
_client_healthy: bool = False
_admin_healthy: bool = False
_last_health_check: float = 0
HEALTH_CHECK_INTERVAL = 60
MAX_CLIENT_AGE = 300


def _get_client(service_role: bool = False) -> Client:
    from supabase import create_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY if service_role else settings.SUPABASE_ANON_KEY
    if not url or not key:
        raise AppException(
            "Supabase is not configured",
            status_code=503,
            code="service_unavailable",
        )

    client = create_client(url, key)

    # Verify connectivity with a lightweight query
    try:
        client.table("_dummy_check_").select("id").limit(1).execute()
    except Exception:
        pass  # expected to fail — we just want to trigger the connection

    return client


def _is_client_stale(client: Client) -> bool:
    """Check if the client might have stale connections or cache."""
    return False  # Defer to health check logic


def _refresh_if_needed(service_role: bool) -> Client:
    """Create a fresh client if the existing one is stale or unhealthy."""
    global _supabase_instance, _supabase_admin_instance, _last_health_check

    client = _supabase_admin_instance if service_role else _supabase_instance
    if client is None:
        return _get_client(service_role)

    now = time.monotonic()
    if now - _last_health_check > HEALTH_CHECK_INTERVAL:
        try:
            # Simple connectivity check — query public config
            r = client.auth.get_session()
            _last_health_check = now
        except Exception:
            logger.warning("Supabase client health check failed. Creating new client.")
            new_client = _get_client(service_role)
            if service_role:
                _supabase_admin_instance = new_client
            else:
                _supabase_instance = new_client
            return new_client

    return client


def get_supabase() -> Client:
    global _supabase_instance
    if _supabase_instance is None:
        with _lock:
            if _supabase_instance is None:
                _supabase_instance = _get_client(service_role=False)
    return _supabase_instance


def get_supabase_admin() -> Client:
    global _supabase_admin_instance
    if _supabase_admin_instance is None:
        with _lock:
            if _supabase_admin_instance is None:
                _supabase_admin_instance = _get_client(service_role=True)
    return _supabase_admin_instance


def reset_clients() -> None:
    """Force recreation of all clients. Useful after configuration changes."""
    global _supabase_instance, _supabase_admin_instance
    with _lock:
        _supabase_instance = None
        _supabase_admin_instance = None


def verify_schema_tables(required_tables: list[str]) -> list[str]:
    """Verify that required tables exist. Returns list of missing tables."""
    missing = []
    for table_name in required_tables:
        try:
            client = get_supabase_admin()
            result = client.table(table_name).select("id").limit(1).execute()
        except Exception as e:
            error_str = str(e)
            if "PGRST205" in error_str or "relation" in error_str.lower():
                missing.append(table_name)
            else:
                logger.warning("Could not verify table '%s': %s", table_name, error_str)
                missing.append(table_name)
    return missing
