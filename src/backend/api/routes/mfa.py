from __future__ import annotations

import hashlib
import hmac
import struct
import time
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request

from src.backend.api.dependencies.authentication import get_current_user
from src.backend.infrastructure.database.repositories.mfa_repository import MFARepository
from src.backend.infrastructure.database.repositories.audit_repository import AuditRepository

router = APIRouter(prefix="/mfa", tags=["MFA"])


def generate_totp_secret() -> str:
    import secrets
    import base64
    return base64.b32encode(secrets.token_bytes(20)).decode()


def verify_totp(secret: str, code: str) -> bool:
    try:
        code_int = int(code)
    except (ValueError, TypeError):
        return False
    if len(code) != 6:
        return False
    for offset in (-1, 0, 1):
        expected = _totp_at_time(secret, time.time() + offset * 30)
        if code_int == expected:
            return True
    return False


def _totp_at_time(secret: str, for_time: float) -> int:
    import base64
    try:
        key = base64.b32decode(secret.upper())
    except Exception:
        return -1
    msg = struct.pack(">Q", int(for_time / 30))
    h = hmac.new(key, msg, hashlib.sha1).digest()
    o = h[19] & 15
    return (struct.unpack(">I", h[o:o+4])[0] & 0x7FFFFFFF) % 1000000


@router.get("/setup")
async def get_mfa_status(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    devices = MFARepository.find_active_by_user(user["id"])
    return {"devices": devices, "has_mfa": any(d.get("is_active") and d.get("verified") for d in devices)}


@router.post("/setup")
async def setup_mfa(
    body: Dict[str, Any],
    request: Request,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    mfa_type = body.get("type", "totp")
    if mfa_type not in ("totp", "sms", "email"):
        raise HTTPException(status_code=400, detail="MFA type must be 'totp', 'sms', or 'email'")

    existing = MFARepository.find_active_by_user(user["id"])
    if any(d["type"] == mfa_type and d["is_active"] for d in existing):
        raise HTTPException(status_code=409, detail=f"{mfa_type.upper()} MFA is already configured")

    secret = generate_totp_secret() if mfa_type == "totp" else ""
    phone = body.get("phone", "") if mfa_type == "sms" else ""

    device = MFARepository.create({
        "user_id": user["id"],
        "type": mfa_type,
        "secret": secret,
        "phone": phone,
        "is_active": True,
        "verified": False,
    })

    AuditRepository.log(
        user_id=user["id"],
        action="mfa_setup_initiated",
        details={"type": mfa_type, "device_id": device["id"] if device else ""},
        ip_address=request.client.host if request.client else "",
    )

    return {
        "message": f"{mfa_type.upper()} setup initiated. Verify with a code to activate.",
        "device_id": device["id"] if device else None,
        "secret": secret if mfa_type == "totp" else None,
    }


@router.post("/verify")
async def verify_mfa(
    body: Dict[str, Any],
    request: Request,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    code = body.get("code", "").strip()
    device_id = body.get("device_id", "")

    if not code or not device_id:
        raise HTTPException(status_code=400, detail="Code and device_id are required")

    devices = MFARepository.find_active_by_user(user["id"])
    device = next((d for d in devices if d["id"] == device_id), None)

    if not device:
        raise HTTPException(status_code=404, detail="MFA device not found")

    if device.get("verified"):
        raise HTTPException(status_code=400, detail="MFA device is already verified")

    if device["type"] == "totp":
        if not verify_totp(device.get("secret", ""), code):
            raise HTTPException(status_code=400, detail="Invalid verification code")
    else:
        raise HTTPException(status_code=400, detail="Only TOTP verification is currently supported")

    MFARepository.update(device_id, {"verified": True})

    AuditRepository.log(
        user_id=user["id"],
        action="mfa_verified",
        details={"type": device["type"], "device_id": device_id},
        ip_address=request.client.host if request.client else "",
    )

    return {"message": f"{device['type'].upper()} MFA activated successfully"}


@router.delete("/{device_id}")
async def remove_mfa_device(
    device_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    devices = MFARepository.find_active_by_user(user["id"])
    device = next((d for d in devices if d["id"] == device_id), None)

    if not device:
        raise HTTPException(status_code=404, detail="MFA device not found")

    MFARepository.update(device_id, {"is_active": False})

    AuditRepository.log(
        user_id=user["id"],
        action="mfa_removed",
        details={"type": device["type"], "device_id": device_id},
        ip_address=request.client.host if request.client else "",
    )

    return {"message": "MFA device removed"}
