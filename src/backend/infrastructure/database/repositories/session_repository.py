from __future__ import annotations

from typing import Any, Dict, List, Optional
from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository


class SessionRepository(SupabaseRepository):
    TABLE_NAME = "user_sessions"

    @classmethod
    def create_session(cls, user_id: str, device_info: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        return cls.create({
            "user_id": user_id,
            "device_name": (device_info or {}).get("name", ""),
            "device_type": (device_info or {}).get("type", "unknown"),
            "ip_address": (device_info or {}).get("ip", ""),
            "user_agent": (device_info or {}).get("user_agent", ""),
        })

    @classmethod
    def find_by_user(cls, user_id: str, active_only: bool = True, limit: int = 20) -> List[Dict[str, Any]]:
        query = cls._table().select("*").eq("user_id", user_id)
        if active_only:
            query = query.eq("is_active", True)
        result = query.order("last_activity", desc=True).limit(limit).execute()
        return result.data

    @classmethod
    def deactivate(cls, session_id: str) -> bool:
        result = cls._table().update({"is_active": False}).eq("id", session_id).execute()
        return bool(result.data)

    @classmethod
    def deactivate_all_user_sessions(cls, user_id: str, exclude_session_id: Optional[str] = None) -> bool:
        query = cls._table().update({"is_active": False}).eq("user_id", user_id)
        if exclude_session_id:
            query = query.neq("id", exclude_session_id)
        result = query.execute()
        return bool(result.data)

    @classmethod
    def touch_session(cls, session_id: str) -> None:
        cls._table().update({"last_activity": "now()"}).eq("id", session_id).execute()
