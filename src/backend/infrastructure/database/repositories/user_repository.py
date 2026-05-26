from __future__ import annotations

import re
from typing import Any, Dict, Optional
from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _is_uuid(value: Any) -> bool:
    return isinstance(value, str) and bool(_UUID_RE.match(value))


class SupabaseUserRepository(SupabaseRepository):
    TABLE_NAME = "users"

    @classmethod
    def find_by_id(cls, record_id: Any) -> Optional[Dict[str, Any]]:
        if _is_uuid(record_id):
            result = cls._execute_with_retry(
                cls._table().select("*").eq("supabase_user_id", record_id)
            )
            return result.data[0] if result.data else None
        return super().find_by_id(record_id)

    @classmethod
    def find_by_supabase_id(cls, supabase_id: str) -> Optional[Dict[str, Any]]:
        result = cls._execute_with_retry(
            cls._table().select("*").eq("supabase_user_id", supabase_id)
        )
        return result.data[0] if result.data else None

    @classmethod
    def find_by_email(cls, email: str) -> Optional[Dict[str, Any]]:
        result = cls._table().select("*").eq("email", email).execute()
        return result.data[0] if result.data else None

    @classmethod
    def upsert(cls, user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        existing = cls.find_by_supabase_id(user_id)
        if existing:
            result = cls._execute_with_retry(
                cls._table().update(data).eq("supabase_user_id", user_id)
            )
        else:
            data["supabase_user_id"] = user_id
            data.pop("id", None)
            result = cls._execute_with_retry(cls._table().insert(data))
        return result.data[0] if result.data else None

    @classmethod
    def migrate_user_to_supabase(cls, user_id: Any, supabase_id: str) -> Optional[Dict[str, Any]]:
        """Link an existing BIGINT-id user to their auth.users UUID."""
        result = cls._execute_with_retry(
            cls._table().update({"supabase_user_id": supabase_id}).eq("id", user_id)
        )
        return result.data[0] if result.data else None
