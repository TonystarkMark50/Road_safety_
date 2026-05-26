from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.infrastructure.database.repositories.notification_repository import SupabaseNotificationRepository

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def get_notifications(
    user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    return SupabaseNotificationRepository.find_by_user(user["id"], limit=50)


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user)) -> Dict[str, int]:
    count = SupabaseNotificationRepository.unread_count(user["id"])
    return {"count": count}


@router.post("/{notif_id}/read")
async def mark_read(
    notif_id: int,
    user: dict = Depends(get_current_user),
) -> Dict[str, str]:
    success = SupabaseNotificationRepository.mark_as_read(notif_id, user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}
