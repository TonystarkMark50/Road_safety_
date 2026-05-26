from __future__ import annotations

from typing import Any, Dict, List
from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository


class SupabaseNotificationRepository(SupabaseRepository):
    TABLE_NAME = "notifications"

    @classmethod
    def find_by_user(cls, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        result = (
            cls._table()
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data

    @classmethod
    def mark_as_read(cls, notif_id: int, user_id: str) -> bool:
        result = cls._table().update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
        return bool(result.data)

    @classmethod
    def unread_count(cls, user_id: str) -> int:
        result = cls._table().select("id", count="exact").eq("user_id", user_id).eq("is_read", False).execute()
        return result.count or 0

    @classmethod
    def create_notification(cls, user_id: str, title: str, message: str, notif_type: str = "general") -> Dict[str, Any]:
        return cls.create({
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notif_type,
        })
