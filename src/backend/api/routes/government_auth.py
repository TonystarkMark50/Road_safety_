from __future__ import annotations

import re
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request

from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.permissions import require_admin
from src.backend.infrastructure.database.repositories.government_request_repository import GovernmentRequestRepository
from src.backend.infrastructure.database.repositories.audit_repository import AuditRepository
from src.backend.infrastructure.database.supabase_client import get_supabase
from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository

router = APIRouter(prefix="/gov", tags=["Government"])

# Official government email domains
GOV_EMAIL_DOMAINS = frozenset({
    "gov.in", "nic.in", "gov.in", "gov.in",  # Central
    "rajasthan.gov.in", "up.gov.in", "maharashtra.gov.in", "tn.gov.in",
    "karnataka.gov.in", "gujarat.gov.in", "wb.gov.in", "mp.gov.in",
    "bihar.gov.in", "odisha.gov.in", "telangana.gov.in", "ap.gov.in",
    "kerala.gov.in", "punjab.gov.in", "haryana.gov.in", "jharkhand.gov.in",
    "assam.gov.in", "chhattisgarh.gov.in", "uk.gov.in", "cg.gov.in",
})


def validate_official_email(email: str) -> bool:
    domain = email.lower().split("@")[-1] if "@" in email else ""
    if domain in GOV_EMAIL_DOMAINS:
        return True
    if domain.endswith(".gov.in") or domain.endswith(".nic.in"):
        return True
    if re.match(r'^[a-zA-Z0-9.-]+\.gov\.in$', domain):
        return True
    if re.match(r'^[a-zA-Z0-9.-]+\.nic\.in$', domain):
        return True
    return False


@router.post("/request-access")
async def request_government_access(
    body: Dict[str, Any],
    request: Request,
) -> Dict[str, Any]:
    full_name = (body.get("full_name") or "").strip()
    department = (body.get("department") or "").strip()
    employee_id = (body.get("employee_id") or "").strip()
    designation = (body.get("designation") or "").strip()
    district = (body.get("district") or "").strip()
    official_email = (body.get("official_email") or "").strip().lower()

    if not all([full_name, department, employee_id, designation, district, official_email]):
        raise HTTPException(status_code=400, detail="All fields are required")

    if not validate_official_email(official_email):
        raise HTTPException(
            status_code=400,
            detail="Only official government email addresses are accepted. Please use your @gov.in, @nic.in, or state government email."
        )

    existing = GovernmentRequestRepository.find_by_email(official_email)
    if existing:
        if existing["status"] == "pending":
            raise HTTPException(status_code=409, detail="A request for this email is already pending review")
        if existing["status"] == "approved":
            raise HTTPException(status_code=409, detail="This email already has approved government access")
        if existing["status"] == "verifying":
            raise HTTPException(status_code=409, detail="This request is already under verification")

    gov_request = GovernmentRequestRepository.create({
        "full_name": full_name,
        "department": department,
        "employee_id": employee_id,
        "designation": designation,
        "district": district,
        "official_email": official_email,
        "government_id_url": body.get("government_id_url", ""),
        "status": "pending",
    })

    AuditRepository.log(
        user_id="",
        action="government_access_requested",
        details={
            "full_name": full_name,
            "department": department,
            "official_email": official_email,
            "request_id": gov_request["id"] if gov_request else "",
        },
        ip_address=request.client.host if request.client else "",
    )

    return {
        "message": "Your government access request has been submitted for review. You will be notified when your account is verified.",
        "request_id": gov_request["id"] if gov_request else None,
    }


@router.get("/request-status")
async def check_request_status(email: str = "") -> Dict[str, Any]:
    if not email:
        raise HTTPException(status_code=400, detail="Email parameter is required")
    email = email.strip().lower()
    gov_request = GovernmentRequestRepository.find_by_email(email)
    if not gov_request:
        return {"status": "not_found", "message": "No request found for this email"}
    return {
        "status": gov_request["status"],
        "message": f"Your request is {gov_request['status'].replace('_', ' ')}",
        "requested_at": gov_request.get("created_at", ""),
    }


@router.get("/requests")
async def list_gov_requests(
    status_filter: str = "pending",
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    if status_filter == "all":
        requests = GovernmentRequestRepository.find_all(limit=100, order_by="created_at", order_direction="desc")
    else:
        requests = GovernmentRequestRepository.find_by_status(status_filter, limit=100)
    return {"requests": requests}


@router.patch("/requests/{request_id}")
async def review_gov_request(
    request_id: str,
    body: Dict[str, Any],
    request: Request,
    admin: dict = Depends(require_admin),
) -> Dict[str, Any]:
    decision = body.get("status", "").lower()
    if decision not in ("approved", "rejected", "verifying", "suspended"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved', 'rejected', 'verifying', or 'suspended'")

    gov_request = GovernmentRequestRepository.find_by_id(request_id)
    if not gov_request:
        raise HTTPException(status_code=404, detail="Government request not found")

    notes = body.get("review_notes", "")
    GovernmentRequestRepository.review(request_id, decision, admin["id"], notes)

    if decision == "approved":
        existing_user = SupabaseUserRepository.find_by_email(gov_request["official_email"])
        if existing_user:
            SupabaseUserRepository.update(existing_user["id"], {"role": "authority", "is_authority_verified": True})
        else:
            try:
                supabase = get_supabase()
                supabase.auth.admin.invite_user_by_email(gov_request["official_email"])
            except Exception:
                pass

    AuditRepository.log(
        user_id=admin["id"],
        action=f"government_request_{decision}",
        details={
            "target_email": gov_request["official_email"],
            "full_name": gov_request["full_name"],
            "department": gov_request["department"],
            "request_id": request_id,
            "notes": notes,
        },
        ip_address=request.client.host if request.client else "",
    )

    return {"message": f"Government request {decision}", "decision": decision}
