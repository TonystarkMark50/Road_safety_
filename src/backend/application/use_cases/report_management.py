from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from src.backend.core.constants import DEPARTMENT_ROUTING, ReportStatus
from src.backend.domain.report_access import can_update_report, sanitize_report_public
from src.backend.domain.exceptions import ForbiddenException, NotFoundException
from src.backend.infrastructure.database.repositories.report_repository import SupabaseReportRepository
from src.backend.infrastructure.database.repositories.notification_repository import SupabaseNotificationRepository
from src.backend.infrastructure.queue.tasks import assign_department


def get_next_ticket_id() -> str:
    now = datetime.now(timezone.utc)
    short_id = uuid.uuid4().hex[:6].upper()
    return f"RD-{now.strftime('%y%m')}-{short_id}"


def create_report(user_id: str, data: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    department = assign_department(0, data.get("category", "other")) or DEPARTMENT_ROUTING.get(
        data.get("category", "other"), "Municipality"
    )
    ticket_id = get_next_ticket_id()
    record = {
        "ticket_id": ticket_id,
        "title": data["title"],
        "category": data["category"],
        "description": data["description"],
        "severity": data.get("severity", "medium"),
        "status": ReportStatus.SUBMITTED.value,
        "latitude": data.get("location", {}).get("latitude"),
        "longitude": data.get("location", {}).get("longitude"),
        "address": data.get("address", ""),
        "user_id": user_id,
        "assigned_department": department,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    report = SupabaseReportRepository.create(record)
    if report:
        SupabaseNotificationRepository.create_notification(
            user_id=user_id,
            title="Report Submitted",
            message=f"Your report '{data['title']}' has been submitted. Ticket ID: {ticket_id}",
            notif_type="report_update",
        )
        return report, None
    return None, "Failed to create report"


def get_report(report_id: int) -> Optional[Dict[str, Any]]:
    return SupabaseReportRepository.find_by_id(report_id)


def list_reports(
    user_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    department: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[Dict[str, Any]], int]:
    offset = (page - 1) * per_page
    reports = SupabaseReportRepository.find_with_filters(
        category=category,
        status=status,
        department=department,
        user_id=user_id,
        limit=per_page,
        offset=offset,
    )
    total = SupabaseReportRepository.count()
    return reports, total


def update_report(
    report_id: int,
    data: Dict[str, Any],
    user: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    existing = SupabaseReportRepository.find_by_id(report_id)
    if not existing:
        return None
    if user is not None:
        allowed, message, filtered = can_update_report(user, existing, data)
        if not allowed:
            raise ForbiddenException(message or "Not allowed to update this report")
        data = filtered
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    old_status = existing.get("status")
    new_status = data.get("status", old_status)
    if new_status != old_status and new_status in ("resolved", "closed"):
        SupabaseNotificationRepository.create_notification(
            user_id=existing["user_id"],
            title="Report Update",
            message=f"Your report '{existing['title']}' status changed to {new_status}",
            notif_type="report_update",
        )
    return SupabaseReportRepository.update(report_id, data)


def upvote_report(report_id: int) -> int:
    return SupabaseReportRepository.increment_upvotes(report_id)


def get_public_dashboard_stats() -> Dict[str, Any]:
    stats = get_dashboard_stats()
    return {
        "total": stats["total"],
        "open": stats["open"],
        "resolved": stats["resolved"],
        "resolution_rate": stats["resolution_rate"],
        "active_users": stats.get("active_users", 0),
    }


def get_dashboard_stats() -> Dict[str, Any]:
    from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository

    by_status = SupabaseReportRepository.count_by_status()
    total = sum(by_status.values())
    try:
        active_users = SupabaseUserRepository.count()
    except Exception:
        active_users = 0
    
    # Get today's date for filtering recent actions
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Count resolved today (simplified - in a real app we'd filter by updated_at date)
    resolved_today = 0  # Placeholder - would need to query reports resolved today
    
    # For demonstration, we'll return some additional stats
    # In a production system, these would come from proper database queries
    return {
        "total": total,
        "by_status": by_status,
        "open": by_status.get("submitted", 0) + by_status.get("under_review", 0) + by_status.get("assigned", 0) + by_status.get("in_progress", 0),
        "resolved": by_status.get("resolved", 0),
        "resolution_rate": round(by_status.get("resolved", 0) / max(total, 1) * 100, 1),
        "resolved_today": resolved_today,  # Placeholder
        "recent_actions": resolved_today,  # Placeholder for government actions today
        "active_users": active_users,
    }
