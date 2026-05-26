from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Depends
from src.backend.api.dependencies.permissions import require_admin
from src.backend.application.use_cases.report_management import get_dashboard_stats
from src.backend.infrastructure.database.repositories.report_repository import SupabaseReportRepository
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository
from src.backend.infrastructure.database.repositories.login_attempt_repository import LoginAttemptRepository

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
async def admin_dashboard(admin: dict = Depends(require_admin)) -> Dict[str, Any]:
    stats = get_dashboard_stats()
    total_users = SupabaseUserRepository.count()
    return {
        **stats,
        "total_users": total_users,
    }


@router.get("/reports")
async def admin_reports(
    status: str = "",
    department: str = "",
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    filters = {}
    if status:
        filters["status"] = status
    if department:
        filters["department"] = department
    reports = SupabaseReportRepository.find_with_filters(**filters, limit=100)
    count = SupabaseReportRepository.count()
    return {"count": count, "reports": reports}


@router.get("/login-attempts")
async def admin_login_attempts(
    limit: int = 50,
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    attempts = LoginAttemptRepository.find_recent(limit=limit)
    return {"attempts": attempts, "total": len(attempts)}
