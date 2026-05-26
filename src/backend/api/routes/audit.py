from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Depends
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.permissions import require_admin
from src.backend.infrastructure.database.repositories.audit_repository import AuditRepository

router = APIRouter(tags=["Audit"])


@router.get("/audit/log")
async def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    logs = AuditRepository.find_all_paginated(limit=limit, offset=offset)
    return {"logs": logs, "limit": limit, "offset": offset}


@router.get("/audit/my-activity")
async def get_my_activity(
    limit: int = 20,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    logs = AuditRepository.find_by_user(user["id"], limit=limit)
    return {"activity": logs}
