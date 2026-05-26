from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from src.backend.application.dtos.authentication import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from src.backend.application.use_cases.authentication import (
    authenticate_user,
    change_password,
    complete_mfa_login,
    logout_user,
    refresh_session,
    register_user,
)
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.rate_limiter import rate_limit
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository

router = APIRouter(prefix="/auth", tags=["Authentication"])


class MfaVerifyRequest(BaseModel):
    mfa_token: str = Field(..., min_length=10)
    code: str = Field(..., min_length=6, max_length=6)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/register")
async def register(
    body: RegisterRequest,
    request: Request,
    _: None = Depends(rate_limit("register")),
) -> Dict[str, Any]:
    bootstrap = request.headers.get("x-bootstrap-admin-token")
    result = await register_user(body.email, body.password, body.name, body.phone, bootstrap)
    if result.get("session"):
        return {
            "access_token": result["session"]["access_token"],
            "refresh_token": result["session"]["refresh_token"],
            "token_type": "bearer",
            "user": result["user"],
        }
    return {
        "access_token": "",
        "refresh_token": "",
        "token_type": "bearer",
        "user": result["user"],
    }


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    _: None = Depends(rate_limit("login")),
) -> Dict[str, Any]:
    result = await authenticate_user(
        body.email,
        body.password,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    if result.get("mfa_required"):
        return {
            "mfa_required": True,
            "mfa_token": result["mfa_token"],
            "user": result["user"],
        }
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": "bearer",
        "user": result["user"],
    }


@router.post("/verify-mfa")
async def verify_mfa(
    body: MfaVerifyRequest,
    _: None = Depends(rate_limit("login")),
) -> Dict[str, Any]:
    result = await complete_mfa_login(body.mfa_token, body.code)
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": "bearer",
        "user": result["user"],
    }


@router.post("/refresh")
async def refresh(
    body: RefreshRequest,
    _: None = Depends(rate_limit("refresh")),
) -> Dict[str, Any]:
    return await refresh_session(body.refresh_token)


@router.post("/logout")
async def logout(
    authorization: str = Header(None),
) -> Dict[str, str]:
    from src.backend.api.dependencies.authentication import get_optional_user
    user = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            user = await get_optional_user(authorization)
        except Exception:
            user = None
        await logout_user(token, user_id=user["id"] if user else None)
    return {"message": "Logged out successfully"}


@router.post("/change-password")
async def change_password_endpoint(
    body: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
    authorization: str = Header(None),
) -> Dict[str, str]:
    token = authorization.split(" ", 1)[1] if authorization and authorization.startswith("Bearer ") else ""
    await change_password(token, body.current_password, body.new_password)
    return {"message": "Password changed successfully"}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    profile = SupabaseUserRepository.find_by_id(user["id"])
    if profile:
        profile.pop("id", None)
        return {"user": {**user, **profile}}
    return {"user": user}


@router.get("/users/count")
async def users_count(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    count = SupabaseUserRepository.count()
    return {"count": count, "total": count}
