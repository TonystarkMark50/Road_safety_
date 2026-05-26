from __future__ import annotations

from typing import Dict

from fastapi import APIRouter

from src.backend.core.config import settings

router = APIRouter(prefix="/config", tags=["Configuration"])


@router.get("/public")
async def public_config() -> Dict[str, str]:
    return {
        "supabase_url": settings.SUPABASE_URL,
        "supabase_anon_key": settings.SUPABASE_ANON_KEY,
        "app_env": settings.APP_ENV,
    }
