from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional

from gotrue.errors import AuthApiError

from src.backend.core.config import settings
from src.backend.domain.exceptions import (
    ConflictException,
    ForbiddenException,
    RateLimitException,
    UnauthorizedException,
    ValidationException,
)
from src.backend.infrastructure.database.supabase_client import get_supabase, get_supabase_admin
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository
from src.backend.infrastructure.database.repositories.audit_repository import AuditRepository
from src.backend.infrastructure.database.repositories.login_attempt_repository import LoginAttemptRepository
from src.backend.infrastructure.database.repositories.session_repository import SessionRepository
from src.backend.infrastructure.database.repositories.mfa_repository import MFARepository


def _raise_auth_error(exc: AuthApiError) -> None:
    message = str(exc) or "Authentication request failed"
    lowered = message.lower()
    if "rate limit" in lowered:
        raise RateLimitException() from exc
    if "already" in lowered or "registered" in lowered:
        raise ConflictException(message) from exc
    raise ValidationException(message) from exc


def _signing_key() -> bytes:
    key = settings.SECRET_KEY or "dev-only-insecure-key-change-in-production"
    return key.encode()


def create_mfa_challenge(user_id: str, access_token: str, refresh_token: str) -> str:
    payload = {
        "uid": user_id,
        "access": access_token,
        "refresh": refresh_token,
        "exp": int(time.time()) + 300,
    }
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = hmac.new(_signing_key(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def verify_mfa_challenge(token: str) -> Optional[Dict[str, Any]]:
    try:
        raw, sig = token.rsplit(".", 1)
        expected = hmac.new(_signing_key(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return None
        padded = raw + "=" * (-len(raw) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def _privileged_role(role: str) -> bool:
    return role in settings.PRIVILEGED_ROLES


async def register_user(
    email: str,
    password: str,
    name: str,
    phone: Optional[str] = None,
    bootstrap_token: Optional[str] = None,
) -> Dict[str, Any]:
    supabase = get_supabase()
    try:
        response = await asyncio.to_thread(
            supabase.auth.sign_up, {"email": email, "password": password}
        )
    except AuthApiError as exc:
        _raise_auth_error(exc)
    if response.user is None:
        raise ValidationException("Registration failed")

    metadata: Dict[str, Any] = {"name": name}
    if phone:
        metadata["phone"] = phone

    if response.session:
        await asyncio.to_thread(supabase.auth.update_user, {"data": metadata})
    else:
        try:
            admin_supabase = get_supabase_admin()
            await asyncio.to_thread(
                admin_supabase.auth.admin.update_user_by_id,
                response.user.id,
                {"user_metadata": metadata},
            )
        except Exception:
            pass

    existing_user_count = await asyncio.to_thread(SupabaseUserRepository.count)
    role = "citizen"
    if existing_user_count == 0:
        if settings.BOOTSTRAP_ADMIN_TOKEN and bootstrap_token == settings.BOOTSTRAP_ADMIN_TOKEN:
            role = "admin"
        elif not settings.BOOTSTRAP_ADMIN_TOKEN:
            role = "admin"
    elif bootstrap_token and settings.BOOTSTRAP_ADMIN_TOKEN and bootstrap_token == settings.BOOTSTRAP_ADMIN_TOKEN:
        raise ForbiddenException("Admin bootstrap is closed")

    await asyncio.to_thread(
        SupabaseUserRepository.upsert,
        response.user.id,
        {
            "email": email,
            "name": name,
            "phone": phone or "",
            "role": role,
        },
    )

    await asyncio.to_thread(
        AuditRepository.log,
        user_id=response.user.id,
        action="account_created",
        details={"role": role, "method": "email"},
        ip_address="",
    )

    session_data = None
    if response.session:
        session_data = {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
        }

    return {
        "user": {"id": response.user.id, "email": email, "name": name, "role": role},
        "session": session_data,
    }


async def authenticate_user(
    email: str,
    password: str,
    ip_address: str = "",
    user_agent: str = "",
) -> Dict[str, Any]:
    if await asyncio.to_thread(
        LoginAttemptRepository.get_recent_failures,
        email,
        settings.LOGIN_LOCKOUT_MINUTES,
        settings.LOGIN_LOCKOUT_ATTEMPTS,
    ):
        raise RateLimitException(retry_after=settings.LOGIN_LOCKOUT_MINUTES * 60)
    if ip_address and await asyncio.to_thread(
        LoginAttemptRepository.get_recent_failures_by_ip,
        ip_address,
    ):
        raise RateLimitException(retry_after=settings.LOGIN_LOCKOUT_MINUTES * 60)

    supabase = get_supabase()
    try:
        response = await asyncio.to_thread(
            supabase.auth.sign_in_with_password, {"email": email, "password": password}
        )
    except AuthApiError as exc:
        await asyncio.to_thread(
            LoginAttemptRepository.record,
            email,
            ip_address,
            user_agent,
            "citizen",
            False,
        )
        _raise_auth_error(exc)

    if response.user is None:
        await asyncio.to_thread(
            LoginAttemptRepository.record, email, ip_address, user_agent, "citizen", False
        )
        raise UnauthorizedException("Invalid email or password")

    profile = await asyncio.to_thread(SupabaseUserRepository.find_by_id, response.user.id)
    if profile is None:
        profile = await asyncio.to_thread(
            SupabaseUserRepository.upsert,
            response.user.id,
            {
                "email": response.user.email or "",
                "name": (response.user.user_metadata or {}).get("name", ""),
                "role": "citizen",
                "phone": (response.user.user_metadata or {}).get("phone", ""),
            },
        ) or {}

    role = profile.get("role", "citizen")
    user_dict = {
        "id": response.user.id,
        "email": response.user.email or "",
        "name": profile.get("name", response.user.user_metadata.get("name", "")),
        "role": role,
    }

    if not response.session:
        raise UnauthorizedException("Login failed - please confirm your email first")

    await asyncio.to_thread(
        LoginAttemptRepository.record, email, ip_address, user_agent, "citizen", True
    )
    await asyncio.to_thread(
        AuditRepository.log,
        user_id=response.user.id,
        action="login_success",
        details={"role": role},
        ip_address=ip_address,
    )
    await asyncio.to_thread(
        SessionRepository.create_session,
        response.user.id,
        {"ip": ip_address, "user_agent": user_agent, "type": "web"},
    )

    if _privileged_role(role) and await asyncio.to_thread(MFARepository.has_active_mfa, response.user.id):
        return {
            "mfa_required": True,
            "mfa_token": create_mfa_challenge(
                response.user.id,
                response.session.access_token,
                response.session.refresh_token,
            ),
            "user": user_dict,
        }

    return {
        "user": user_dict,
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
    }


async def complete_mfa_login(mfa_token: str, code: str) -> Dict[str, Any]:
    payload = verify_mfa_challenge(mfa_token)
    if not payload:
        raise UnauthorizedException("Invalid or expired MFA challenge")

    user_id = payload.get("uid")
    from src.backend.api.routes.mfa import verify_totp

    devices = await asyncio.to_thread(MFARepository.find_active_by_user, user_id)
    verified = False
    for device in devices:
        if device.get("verified") and device.get("type") == "totp" and verify_totp(device.get("secret", ""), code):
            verified = True
            break
    if not verified:
        raise UnauthorizedException("Invalid MFA code")

    profile = await asyncio.to_thread(SupabaseUserRepository.find_by_id, user_id) or {}
    return {
        "user": {
            "id": user_id,
            "email": profile.get("email", ""),
            "name": profile.get("name", ""),
            "role": profile.get("role", "citizen"),
        },
        "access_token": payload.get("access", ""),
        "refresh_token": payload.get("refresh", ""),
    }


async def refresh_session(refresh_token: str) -> Dict[str, Any]:
    supabase = get_supabase()
    response = await asyncio.to_thread(supabase.auth.refresh_session, refresh_token)
    if response.session is None:
        raise UnauthorizedException("Invalid or expired refresh token")
    user = response.user
    profile = None
    if user:
        profile = await asyncio.to_thread(SupabaseUserRepository.find_by_id, user.id)
        if profile is None:
            profile = await asyncio.to_thread(
                SupabaseUserRepository.upsert,
                user.id,
                {
                    "email": user.email or "",
                    "name": (user.user_metadata or {}).get("name", ""),
                    "role": "citizen",
                },
            )
    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "user": {
            "id": user.id if user else "",
            "email": user.email if user else "",
            "name": (profile or {}).get("name", (user.user_metadata or {}).get("name", "") if user else ""),
            "role": (profile or {}).get("role", "citizen"),
        } if user else {},
    }


async def logout_user(access_token: str, user_id: Optional[str] = None) -> None:
    try:
        admin = get_supabase_admin()
        await asyncio.to_thread(admin.auth.admin.sign_out, access_token)
    except Exception:
        supabase = get_supabase()
        try:
            await asyncio.to_thread(supabase.auth.sign_out)
        except Exception:
            pass
    if user_id:
        await asyncio.to_thread(SessionRepository.deactivate_all_user_sessions, user_id)


async def change_password(access_token: str, current_password: str, new_password: str) -> None:
    supabase = get_supabase()
    user = await asyncio.to_thread(supabase.auth.get_user, access_token)
    if user.user is None:
        raise UnauthorizedException()
    login = await asyncio.to_thread(
        supabase.auth.sign_in_with_password,
        {"email": user.user.email or "", "password": current_password},
    )
    if login.user is None:
        raise UnauthorizedException("Current password is incorrect")
    await asyncio.to_thread(supabase.auth.update_user, {"password": new_password})
    await asyncio.to_thread(SessionRepository.deactivate_all_user_sessions, user.user.id)

