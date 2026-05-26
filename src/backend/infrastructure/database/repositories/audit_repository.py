from __future__ import annotations

from typing import Any, Dict, List, Optional
from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository


class AuditRepository(SupabaseRepository):
    TABLE_NAME = "audit_log"

    @classmethod
    def log(cls, user_id: str, action: str, details: Optional[Dict[str, Any]] = None, ip_address: str = "") -> Optional[Dict[str, Any]]:
        return cls.create({
            "user_id": user_id,
            "action": action,
            "details": details or {},
            "ip_address": ip_address,
        })

    @classmethod
    def find_by_user(cls, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        return cls.find_by("user_id", user_id, limit=limit)

    @classmethod
    def find_by_action(cls, action: str, limit: int = 50) -> List[Dict[str, Any]]:
        return cls.find_by("action", action, limit=limit)

    @classmethod
    def find_all_paginated(cls, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        return cls.find_all(limit=limit, offset=offset, order_by="created_at", order_direction="desc")
