from __future__ import annotations

from typing import Any, Dict, List
from fastapi import Depends, HTTPException
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_elevated(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "authority", "emergency"):
        raise HTTPException(status_code=403, detail="Elevated access required")
    return user


def require_one_of(roles: List[str]):
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Access restricted to: {', '.join(roles)}")
        return user
    return _check


async def get_full_user(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    profile = SupabaseUserRepository.find_by_id(user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return profile
