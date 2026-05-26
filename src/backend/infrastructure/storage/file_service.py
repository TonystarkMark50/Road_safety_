from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
from typing import Optional, Tuple
from src.backend.core.config import settings
from src.backend.core.constants import ALLOWED_UPLOAD_MIME_TYPES

MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],
    "video/mp4": [b"\x00\x00\x00", b"ftyp"],
    "video/webm": [b"\x1a\x45\xdf\xa3"],
    "audio/mpeg": [b"\xff\xfb", b"\xff\xf3", b"ID3"],
    "audio/wav": [b"RIFF"],
    "audio/ogg": [b"OggS"],
}


def detect_mime_from_bytes(file_bytes: bytes) -> Optional[str]:
    for mime, signatures in MAGIC_SIGNATURES.items():
        for sig in signatures:
            if mime == "image/webp" and file_bytes[:4] == b"RIFF" and len(file_bytes) > 11 and file_bytes[8:12] == b"WEBP":
                return mime
            if mime == "video/mp4" and len(file_bytes) > 8 and b"ftyp" in file_bytes[:12]:
                return mime
            if file_bytes.startswith(sig):
                return mime
    return None


def validate_file(content_type: str, file_size: int, file_bytes: Optional[bytes] = None) -> Tuple[bool, str]:
    if content_type not in ALLOWED_UPLOAD_MIME_TYPES:
        return False, f"File type not allowed: {content_type}"
    if file_size > settings.MAX_FILE_SIZE:
        max_mb = settings.MAX_FILE_SIZE / (1024 * 1024)
        return False, f"File exceeds maximum size of {max_mb}MB"
    if file_bytes:
        detected = detect_mime_from_bytes(file_bytes)
        if detected and detected != content_type and not (
            content_type == "image/jpeg" and detected == "image/jpeg"
        ):
            if detected not in ALLOWED_UPLOAD_MIME_TYPES:
                return False, "File content does not match declared type"
    return True, ""


def ensure_upload_dir(user_id: str) -> Path:
    user_dir = settings.UPLOAD_PATH / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def save_file(file_bytes: bytes, content_type: str, user_id: str) -> Optional[Tuple[str, str]]:
    """Returns (media_id, relative_path) or None on failure."""
    ext = ALLOWED_UPLOAD_MIME_TYPES.get(content_type, ".bin")
    media_id = uuid.uuid4().hex
    checksum = hashlib.sha256(file_bytes[:8192]).hexdigest()[:16]
    filename = f"{media_id}_{checksum}{ext}"
    user_dir = ensure_upload_dir(user_id)
    file_path = user_dir / filename
    try:
        file_path.write_bytes(file_bytes)
        relative = f"{user_id}/{filename}"
        return media_id, relative
    except OSError:
        return None


def resolve_media_path(user_id: str, media_id: str) -> Optional[Path]:
    user_dir = settings.UPLOAD_PATH / user_id
    if not user_dir.exists():
        return None
    for candidate in user_dir.glob(f"{media_id}_*"):
        if candidate.is_file():
            return candidate
    return None


def delete_file(file_path: str) -> bool:
    try:
        path = Path(file_path)
        if not path.is_absolute():
            path = settings.UPLOAD_PATH / file_path
        if path.exists() and path.is_relative_to(settings.UPLOAD_PATH):
            path.unlink()
            return True
        return False
    except OSError:
        return False


def get_user_storage_usage(user_id: str) -> int:
    user_dir = settings.UPLOAD_PATH / user_id
    if not user_dir.exists():
        return 0
    return sum(f.stat().st_size for f in user_dir.rglob("*") if f.is_file())
