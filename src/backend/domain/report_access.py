from __future__ import annotations

from typing import Any, Dict, Optional, Set

ELEVATED_ROLES = frozenset({"admin", "authority", "emergency"})
CITIZEN_UPDATE_FIELDS = frozenset({"description", "address"})
ELEVATED_UPDATE_FIELDS = frozenset({
    "status",
    "severity",
    "assigned_department",
    "description",
    "address",
    "category",
})
ADMIN_UPDATE_FIELDS = ELEVATED_UPDATE_FIELDS | frozenset({"title"})

PUBLIC_REPORT_FIELDS = (
    "id",
    "ticket_id",
    "title",
    "category",
    "severity",
    "status",
    "address",
    "upvotes",
    "assigned_department",
    "created_at",
    "latitude",
    "longitude",
)


def _report_owner_id(report: Dict[str, Any]) -> Optional[str]:
    owner = report.get("user_id") or report.get("supabase_user_id")
    return str(owner) if owner is not None else None


def can_read_report(user: Optional[Dict[str, Any]], report: Dict[str, Any]) -> bool:
    if user is None:
        return False
    role = user.get("role", "citizen")
    if role == "admin":
        return True
    owner = _report_owner_id(report)
    if owner and str(user.get("id")) == owner:
        return True
    if role in ELEVATED_ROLES:
        return True
    return False


def sanitize_report_public(report: Dict[str, Any]) -> Dict[str, Any]:
    return {k: report[k] for k in PUBLIC_REPORT_FIELDS if k in report}


def filter_update_fields(role: str, data: Dict[str, Any], is_owner: bool) -> Dict[str, Any]:
    if role == "admin":
        allowed = ADMIN_UPDATE_FIELDS
    elif role in ELEVATED_ROLES:
        allowed = ELEVATED_UPDATE_FIELDS
    elif is_owner:
        allowed = CITIZEN_UPDATE_FIELDS
    else:
        return {}
    return {k: v for k, v in data.items() if k in allowed}


def can_update_report(
    user: Dict[str, Any],
    report: Dict[str, Any],
    data: Dict[str, Any],
) -> tuple[bool, str, Dict[str, Any]]:
    role = user.get("role", "citizen")
    owner = _report_owner_id(report)
    is_owner = owner is not None and str(user.get("id")) == owner

    if role == "citizen" and not is_owner:
        return False, "You can only update your own reports", {}

    if role == "citizen" and report.get("status") not in ("submitted", "under_review", None):
        if set(data.keys()) - CITIZEN_UPDATE_FIELDS:
            return False, "Report can no longer be edited in its current status", {}

    filtered = filter_update_fields(role, data, is_owner)
    if not filtered:
        return False, "No permitted fields to update", {}
    return True, "", filtered
