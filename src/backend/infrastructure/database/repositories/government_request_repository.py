from __future__ import annotations

from typing import Any, Dict, List, Optional
from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository


class GovernmentRequestRepository(SupabaseRepository):
    TABLE_NAME = "government_requests"

    @classmethod
    def find_by_email(cls, email: str) -> Optional[Dict[str, Any]]:
        result = cls._table().select("*").eq("official_email", email).execute()
        return result.data[0] if result.data else None

    @classmethod
    def find_pending(cls, limit: int = 50) -> List[Dict[str, Any]]:
        result = cls._table().select("*", count="exact").eq("status", "pending").order("created_at", desc=False).limit(limit).execute()
        return result.data

    @classmethod
    def find_by_status(cls, status: str, limit: int = 50) -> List[Dict[str, Any]]:
        return cls.find_by("status", status, limit=limit)

    @classmethod
    def review(cls, request_id: str, status: str, reviewer_id: str, notes: str = "") -> Optional[Dict[str, Any]]:
        return cls.update(request_id, {
            "status": status,
            "reviewed_by": reviewer_id,
            "review_notes": notes,
            "updated_at": "now()",
        })
