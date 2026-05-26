from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.permissions import require_admin, require_elevated
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository
from src.backend.infrastructure.database.repositories.role_request_repository import RoleRequestRepository
from src.backend.infrastructure.database.repositories.audit_repository import AuditRepository

router = APIRouter(tags=["Roles"])

VALID_ROLES = frozenset({"citizen", "admin", "authority", "emergency"})
UPGRADEABLE_ROLES = frozenset({"authority", "admin"})


def _validate_role(role: str) -> None:
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}")


# ─── User-facing endpoints ────────────────────────────────────────

@router.post("/roles/request-upgrade")
async def request_role_upgrade(
    body: Dict[str, Any],
    request: Request,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    current_role = user.get("role", "citizen")

    if current_role != "citizen":
        raise HTTPException(status_code=403, detail="Only citizens can request role upgrades")

    requested_role = body.get("requested_role", "").lower()
    if requested_role not in UPGRADEABLE_ROLES:
        raise HTTPException(status_code=400, detail=f"You can only request: {', '.join(sorted(UPGRADEABLE_ROLES))}")
    if requested_role == current_role:
        raise HTTPException(status_code=400, detail="You already have this role")

    existing = RoleRequestRepository.find_by_user(user["id"])
    if any(r["status"] == "pending" for r in existing):
        raise HTTPException(status_code=409, detail="You already have a pending upgrade request")

    reason = body.get("reason", "").strip() or f"Requesting {requested_role} upgrade"

    role_request = RoleRequestRepository.create({
        "user_id": user["id"],
        "requested_role": requested_role,
        "reason": reason,
        "status": "pending",
    })

    AuditRepository.log(
        user_id=user["id"],
        action="role_upgrade_requested",
        details={"requested_role": requested_role, "reason": reason, "request_id": role_request["id"] if role_request else ""},
        ip_address=request.client.host if request.client else "",
    )

    return {"message": "Role upgrade request submitted for review", "request": role_request}


@router.get("/roles/requests")
async def get_my_requests(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    requests = RoleRequestRepository.find_by_user(user["id"])
    return {"requests": requests}


# ─── Admin endpoints ───────────────────────────────────────────────

@router.get("/admin/roles/requests")
async def list_role_requests(
    status_filter: str = "pending",
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    if status_filter == "all":
        requests = RoleRequestRepository.find_all(limit=100, order_by="created_at", order_direction="desc")
    else:
        requests = RoleRequestRepository.find_by_status(status_filter, limit=100)
    return {"requests": requests}


@router.patch("/admin/roles/requests/{request_id}")
async def review_role_request(
    request_id: str,
    body: Dict[str, Any],
    request: Request,
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    decision = body.get("status", "").lower()
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")

    role_request = RoleRequestRepository.find_by_id(request_id)
    if not role_request:
        raise HTTPException(status_code=404, detail="Role request not found")
    if role_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {role_request['status']}")

    notes = body.get("review_notes", "")

    RoleRequestRepository.review(request_id, decision, admin["id"], notes)

    if decision == "approved":
        SupabaseUserRepository.update(role_request["user_id"], {"role": role_request["requested_role"]})

    AuditRepository.log(
        user_id=admin["id"],
        action=f"role_request_{decision}",
        details={
            "target_user_id": role_request["user_id"],
            "requested_role": role_request["requested_role"],
            "request_id": request_id,
            "notes": notes,
        },
        ip_address=request.client.host if request.client else "",
    )

    return {"message": f"Role request {decision}", "decision": decision}


@router.patch("/admin/users/{user_id}/role")
async def change_user_role_direct(
    user_id: str,
    body: Dict[str, Any],
    request: Request,
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    new_role = body.get("role", "").lower()
    _validate_role(new_role)

    target = SupabaseUserRepository.find_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target["role"] == "admin":
        raise HTTPException(status_code=403, detail="Cannot modify another admin's role")

    old_role = target["role"]
    result = SupabaseUserRepository.update(user_id, {"role": new_role})

    AuditRepository.log(
        user_id=admin["id"],
        action="role_direct_change",
        details={
            "target_user_id": user_id,
            "old_role": old_role,
            "new_role": new_role,
            "method": "admin_direct",
        },
        ip_address=request.client.host if request.client else "",
    )

    return {"message": f"Role changed from {old_role} to {new_role}", "user": result}


@router.patch("/admin/users/{user_id}/status")
async def change_account_status(
    user_id: str,
    body: Dict[str, Any],
    request: Request,
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    new_status = body.get("status", "").lower()
    if new_status not in ("active", "suspended", "disabled"):
        raise HTTPException(status_code=400, detail="Status must be 'active', 'suspended', or 'disabled'")

    target = SupabaseUserRepository.find_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.get("account_status") == new_status:
        raise HTTPException(status_code=400, detail=f"Account is already {new_status}")

    result = SupabaseUserRepository.update(user_id, {"account_status": new_status})

    AuditRepository.log(
        user_id=admin["id"],
        action=f"account_{new_status}",
        details={"target_user_id": user_id, "previous_status": target.get("account_status", "active")},
        ip_address=request.client.host if request.client else "",
    )

    return {"message": f"Account {new_status}", "user": result}


@router.get("/admin/users")
async def list_all_users(
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    users = SupabaseUserRepository.find_all(limit=200, order_by="created_at", order_direction="desc")
    return {"users": users, "total": len(users)}
