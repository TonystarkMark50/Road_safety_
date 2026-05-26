from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository


class LoginAttemptRepository(SupabaseRepository):
    TABLE_NAME = "login_attempts"

    @classmethod
    def record(cls, email: str, ip: str = "", user_agent: str = "", attempt_type: str = "citizen", success: bool = False) -> None:
        cls.create({
            "email": email,
            "ip_address": ip,
            "user_agent": user_agent,
            "attempt_type": attempt_type,
            "success": success,
        })

    @classmethod
    def get_recent_failures(cls, email: str, minutes: int = 15, max_attempts: int = 5) -> bool:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        result = cls._table().select("id", count="exact").eq("email", email).eq("success", False).gte("created_at", cutoff.isoformat()).execute()
        return (result.count or 0) >= max_attempts

    @classmethod
    def get_recent_failures_by_ip(cls, ip: str, minutes: int = 15, max_attempts: int = 20) -> bool:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        result = cls._table().select("id", count="exact").eq("ip_address", ip).eq("success", False).gte("created_at", cutoff.isoformat()).execute()
        return (result.count or 0) >= max_attempts

    @classmethod
    def find_recent(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return cls.find_all(limit=limit, order_by="created_at", order_direction="desc")
