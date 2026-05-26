from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository
from src.backend.infrastructure.database.repositories.audit_repository import AuditRepository

router = APIRouter(prefix="/profile", tags=["Profile"])

ALLOWED_EDIT_FIELDS = {
    "name", "phone", "avatar_url", "address",
    "emergency_contact", "language", "bio", "notification_preferences",
}

SENSITIVE_FIELDS_FORBIDDEN = {"role", "is_verified", "is_authority_verified", "account_status", "id", "email", "created_at", "updated_at"}


@router.get("")
async def get_profile(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    profile = SupabaseUserRepository.find_by_id(user["id"])
    if not profile:
        profile_data = {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name", user.get("email", "").split("@")[0]),
            "phone": user.get("phone", ""),
            "role": user.get("role", "citizen"),
            "address": "",
            "emergency_contact": "",
            "language": "en",
            "bio": "",
            "avatar_url": user.get("avatar_url", ""),
            "notification_preferences": {"email": True, "push": True, "sms": False},
            "is_verified": False,
            "is_authority_verified": False,
            "account_status": "active",
        }
        profile = SupabaseUserRepository.create(profile_data)
        if not profile:
            raise HTTPException(status_code=500, detail="Failed to create profile")
    return {"profile": profile}


@router.patch("")
async def update_profile(
    data: Dict[str, Any],
    request: Request,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    forbidden = SENSITIVE_FIELDS_FORBIDDEN & set(data.keys())
    if forbidden:
        AuditRepository.log(
            user_id=user["id"],
            action="privilege_escalation_attempt",
            details={"blocked_fields": list(forbidden), "attempted_data": data},
            ip_address=request.client.host if request.client else "",
        )
        raise HTTPException(status_code=403, detail=f"Modifying these fields is forbidden: {', '.join(forbidden)}")

    updates = {k: v for k, v in data.items() if k in ALLOWED_EDIT_FIELDS and v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid editable fields provided")

    result = SupabaseUserRepository.update(user["id"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found")

    AuditRepository.log(
        user_id=user["id"],
        action="profile_update",
        details={"fields": list(updates.keys())},
        ip_address=request.client.host if request.client else "",
    )
    return {"profile": result, "message": "Profile updated successfully"}
