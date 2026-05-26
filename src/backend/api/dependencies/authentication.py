from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from fastapi import Header, HTTPException

from src.backend.infrastructure.database.supabase_client import get_supabase
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository


def _profile_from_auth_user(auth_user: Any) -> Dict[str, Any]:
    meta = auth_user.user_metadata or {}
    return {
        "id": auth_user.id,
        "email": auth_user.email or "",
        "name": meta.get("name") or meta.get("full_name") or "",
        "phone": meta.get("phone") or "",
        "role": "citizen",
        "avatar_url": meta.get("avatar_url") or meta.get("picture") or "",
        "address": "",
        "emergency_contact": "",
        "language": "en",
        "bio": "",
        "notification_preferences": {"email": True, "push": True, "sms": False},
        "is_verified": False,
        "is_authority_verified": False,
        "account_status": "active",
    }


def _get_or_create_profile(auth_user: Any) -> Dict[str, Any]:
    profile = SupabaseUserRepository.find_by_id(auth_user.id)
    if profile:
        return profile
    return SupabaseUserRepository.upsert(auth_user.id, _profile_from_auth_user(auth_user)) or {}


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        supabase = await asyncio.to_thread(get_supabase)

        user = await asyncio.to_thread(supabase.auth.get_user, token)
        if user.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        profile = await asyncio.to_thread(_get_or_create_profile, user.user)
        role = profile.get("role", "citizen")
        account_status = profile.get("account_status", "active")

        if account_status == "suspended":
            raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
        if account_status == "disabled":
            raise HTTPException(status_code=403, detail="Account disabled.")

        return {
            "id": user.user.id,
            "email": user.user.email or "",
            "role": role,
            "name": profile.get("name", ""),
            "phone": profile.get("phone", ""),
            "account_status": account_status,
            "is_verified": profile.get("is_verified", False),
            "is_authority_verified": profile.get("is_authority_verified", False),
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        supabase = await asyncio.to_thread(get_supabase)

        user = await asyncio.to_thread(supabase.auth.get_user, token)
        if user.user is None:
            return None

        profile = await asyncio.to_thread(_get_or_create_profile, user.user)
        role = profile.get("role", "citizen")

        return {
            "id": user.user.id,
            "email": user.user.email or "",
            "role": role,
            "name": profile.get("name", ""),
            "phone": profile.get("phone", ""),
            "account_status": profile.get("account_status", "active"),
            "is_verified": profile.get("is_verified", False),
        }
    except Exception:
        return None
