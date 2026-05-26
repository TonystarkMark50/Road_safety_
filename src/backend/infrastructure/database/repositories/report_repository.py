from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.backend.infrastructure.database.repositories.base_repository import SupabaseRepository


class SupabaseReportRepository(SupabaseRepository):
    TABLE_NAME = "reports"

    @classmethod
    def find_with_filters(
        cls,
        category: Optional[str] = None,
        status: Optional[str] = None,
        department: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        query = cls._table().select("*", count="exact").order("created_at", desc=True)
        if category:
            query = query.eq("category", category)
        if status:
            query = query.eq("status", status)
        if department:
            query = query.eq("assigned_department", department)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.range(offset, offset + limit - 1).execute()
        return result.data

    @classmethod
    def count_by_status(cls) -> Dict[str, int]:
        statuses = ["submitted", "under_review", "assigned", "in_progress", "resolved", "closed"]
        result = cls._table().select("status").execute()
        data = result.data or []
        counts = {s: 0 for s in statuses}
        for row in data:
            s = row.get("status")
            if s in counts:
                counts[s] += 1
        return counts

    @classmethod
    def increment_upvotes(cls, report_id: int) -> int:
        report = cls.find_by_id(report_id)
        if not report:
            return 0
        current = report.get("upvotes", 0) or 0
        cls._table().update({"upvotes": current + 1}).eq("id", report_id).execute()
        return current + 1
