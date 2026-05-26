from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Body
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.permissions import require_admin
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    if current_user["id"] != user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    profile = SupabaseUserRepository.find_by_id(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": profile}


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    allowed = {"name", "phone"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = SupabaseUserRepository.update(user_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": result}


@router.get("")
async def list_users(
    admin: dict = Depends(require_admin),
) -> List[Dict[str, Any]]:
    return SupabaseUserRepository.find_all(limit=100)
