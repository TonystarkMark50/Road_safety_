from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request

from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.permissions import require_admin
from src.backend.infrastructure.database.repositories.session_repository import SessionRepository
from src.backend.infrastructure.database.repositories.audit_repository import AuditRepository

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("")
async def list_sessions(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    sessions = SessionRepository.find_by_user(user["id"], active_only=True)
    return {"sessions": sessions}


@router.delete("/{session_id}")
async def terminate_session(
    session_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    sessions = SessionRepository.find_by_user(user["id"], active_only=True)
    session = next((s for s in sessions if s["id"] == session_id), None)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    SessionRepository.deactivate(session_id)

    AuditRepository.log(
        user_id=user["id"],
        action="session_terminated",
        details={"session_id": session_id},
        ip_address=request.client.host if request.client else "",
    )

    return {"message": "Session terminated"}


@router.delete("")
async def terminate_all_sessions(
    request: Request,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    SessionRepository.deactivate_all_user_sessions(user["id"])

    AuditRepository.log(
        user_id=user["id"],
        action="all_sessions_terminated",
        details={},
        ip_address=request.client.host if request.client else "",
    )

    return {"message": "All sessions terminated"}


@router.get("/admin/all")
async def list_all_sessions(
    limit: int = 50,
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    sessions = SessionRepository.find_all(limit=limit, order_by="last_activity", order_direction="desc")
    return {"sessions": sessions, "total": len(sessions)}
