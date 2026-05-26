from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, TypeVar

from postgrest.exceptions import APIError

from src.backend.infrastructure.database.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

T = TypeVar("T")

MAX_RETRIES = 3
RETRY_DELAY = 1.0
SCHEMA_CACHE_ERRORS = {"PGRST205", "PGRST200", "PGRST204"}


class SupabaseRepository:
    TABLE_NAME: str = ""

    @classmethod
    def _table(cls):
        return get_supabase_admin().table(cls.TABLE_NAME)

    @classmethod
    def _execute_with_retry(cls, query_builder, attempt: int = 0) -> Any:
        try:
            return query_builder.execute()
        except APIError as e:
            code = getattr(e, "code", "") or ""
            if code in SCHEMA_CACHE_ERRORS and attempt < MAX_RETRIES:
                logger.warning(
                    "Schema cache miss for table '%s' (code=%s, attempt=%d/%d). Retrying...",
                    cls.TABLE_NAME, code, attempt + 1, MAX_RETRIES,
                )
                time.sleep(RETRY_DELAY * (attempt + 1))
                return cls._execute_with_retry(query_builder, attempt + 1)
            logger.error(
                "Database query failed for table '%s': code=%s detail=%s",
                cls.TABLE_NAME, code, getattr(e, "message", str(e)),
            )
            raise
        except Exception as e:
            logger.error(
                "Unexpected database error for table '%s': %s",
                cls.TABLE_NAME, str(e),
            )
            raise

    @classmethod
    def table_exists(cls) -> bool:
        try:
            result = cls._table().select("id").limit(1).execute()
            return True
        except APIError:
            return False
        except Exception:
            return False

    @classmethod
    def find_by_id(cls, record_id: Any) -> Optional[Dict[str, Any]]:
        result = cls._execute_with_retry(
            cls._table().select("*").eq("id", record_id)
        )
        return result.data[0] if result.data else None

    @classmethod
    def find_all(
        cls,
        limit: int = 50,
        offset: int = 0,
        order_by: str = "created_at",
        order_direction: str = "desc",
    ) -> List[Dict[str, Any]]:
        result = cls._execute_with_retry(
            cls._table()
            .select("*", count="exact")
            .order(order_by, desc=order_direction == "desc")
            .range(offset, offset + limit - 1)
        )
        return result.data

    @classmethod
    def find_by(cls, field: str, value: Any, limit: int = 50) -> List[Dict[str, Any]]:
        result = cls._execute_with_retry(
            cls._table().select("*").eq(field, value).limit(limit)
        )
        return result.data

    @classmethod
    def create(cls, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        result = cls._execute_with_retry(cls._table().insert(data))
        return result.data[0] if result.data else None

    @classmethod
    def update(cls, record_id: Any, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        result = cls._execute_with_retry(
            cls._table().update(data).eq("id", record_id)
        )
        return result.data[0] if result.data else None

    @classmethod
    def delete(cls, record_id: Any) -> bool:
        result = cls._execute_with_retry(
            cls._table().delete().eq("id", record_id)
        )
        return bool(result.data)

    @classmethod
    def count(cls, field: Optional[str] = None, value: Optional[Any] = None) -> int:
        query = cls._table().select("id", count="exact")
        if field and value is not None:
            query = query.eq(field, value)
        result = cls._execute_with_retry(query)
        return result.count or 0
