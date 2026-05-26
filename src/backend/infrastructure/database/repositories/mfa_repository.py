from __future__ import annotations

from typing import Any, Dict, List, Optional
from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository


class MFARepository(SupabaseRepository):
    TABLE_NAME = "mfa_devices"

    @classmethod
    def find_active_by_user(cls, user_id: str) -> List[Dict[str, Any]]:
        return cls.find_by("user_id", user_id)

    @classmethod
    def has_active_mfa(cls, user_id: str) -> bool:
        devices = cls.find_by("user_id", user_id)
        return any(d.get("is_active") and d.get("verified") for d in devices)

    @classmethod
    def deactivate_all(cls, user_id: str) -> None:
        cls._table().update({"is_active": False}).eq("user_id", user_id).execute()
