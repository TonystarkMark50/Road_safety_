from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.infrastructure.storage.file_service import (
    validate_file,
    save_file,
    delete_file,
    get_user_storage_usage,
    resolve_media_path,
    detect_mime_from_bytes,
)
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository
from src.backend.core.config import settings
from src.backend.core.constants import ALLOWED_UPLOAD_MIME_TYPES

router = APIRouter(prefix="/media", tags=["Media"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    content_type = file.content_type or "application/octet-stream"
    content = await file.read()
    file_size = len(content)

    detected = detect_mime_from_bytes(content)
    if detected:
        content_type = detected

    valid, msg = validate_file(content_type, file_size, content)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    usage = await asyncio.to_thread(get_user_storage_usage, user["id"])
    if usage + file_size > settings.MAX_USER_STORAGE:
        max_mb = settings.MAX_USER_STORAGE / (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Storage limit of {max_mb}MB exceeded")

    saved = await asyncio.to_thread(save_file, content, content_type, user["id"])
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save file")

    media_id, relative = saved
    return {
        "media_id": media_id,
        "url": f"/api/v1/media/{media_id}",
        "content_type": content_type,
        "size": file_size,
    }


@router.get("/{media_id}")
async def get_media(
    media_id: str,
    user: dict = Depends(get_current_user),
):
    if not media_id.isalnum() or len(media_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid media id")
    path = await asyncio.to_thread(resolve_media_path, user["id"], media_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = "application/octet-stream"
    for mime, ext in ALLOWED_UPLOAD_MIME_TYPES.items():
        if path.suffix == ext:
            media_type = mime
            break
    return FileResponse(path, media_type=media_type)


@router.post("/profile-avatar")
async def upload_profile_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        raise HTTPException(status_code=400, detail="Avatar must be a JPEG, PNG, GIF, or WebP image")

    content = await file.read()
    file_size = len(content)
    detected = detect_mime_from_bytes(content)
    if detected:
        content_type = detected

    valid, msg = validate_file(content_type, file_size, content)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    existing = SupabaseUserRepository.find_by_id(user["id"])
    if existing and existing.get("avatar_url"):
        old = existing["avatar_url"]
        if old.startswith("/api/v1/media/"):
            old_id = old.rstrip("/").split("/")[-1]
            old_path = resolve_media_path(user["id"], old_id)
            if old_path:
                delete_file(str(old_path))

    saved = await asyncio.to_thread(save_file, content, content_type, user["id"])
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save avatar")

    media_id, _relative = saved
    avatar_url = f"/api/v1/media/{media_id}"
    SupabaseUserRepository.update(user["id"], {"avatar_url": avatar_url})
    return {"avatar_url": avatar_url, "media_id": media_id, "size": file_size}
