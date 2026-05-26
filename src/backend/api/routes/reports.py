from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from src.backend.application.dtos.report import CreateReportRequest, ReportResponse, UpdateReportRequest
from src.backend.application.use_cases.report_management import (
    create_report as _create_report,
    get_report as _get_report,
    list_reports as _list_reports,
    update_report as _update_report,
    upvote_report as _upvote_report,
    get_dashboard_stats as _get_dashboard_stats,
    get_public_dashboard_stats as _get_public_dashboard_stats,
)
from src.backend.api.dependencies.authentication import get_current_user, get_optional_user
from src.backend.api.dependencies.permissions import require_elevated
from src.backend.domain.report_access import can_read_report, sanitize_report_public
from src.backend.domain.exceptions import ForbiddenException

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/", response_model=ReportResponse, status_code=201)
async def create_new_report(
    body: CreateReportRequest,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    report, error = await asyncio.to_thread(_create_report, user["id"], body.model_dump())
    if error or not report:
        raise HTTPException(status_code=500, detail=error or "Failed to create report")
    return report


@router.get("", response_model=List[ReportResponse])
async def list_all_reports(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    status: Optional[str] = None,
    department: Optional[str] = None,
    user: dict = Depends(require_elevated),
) -> List[Dict[str, Any]]:
    reports, _ = await asyncio.to_thread(
        _list_reports,
        category=category,
        status=status,
        department=department,
        page=page,
        per_page=per_page,
    )
    return reports


@router.get("/my")
async def get_my_reports(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    reports, total = await asyncio.to_thread(_list_reports, user_id=user["id"], page=page, per_page=per_page)
    return {"count": total, "reports": reports}


@router.get("/stats")
async def dashboard_stats() -> Dict[str, Any]:
    return await asyncio.to_thread(_get_public_dashboard_stats)


@router.get("/stats/full")
async def dashboard_stats_full(user: dict = Depends(require_elevated)) -> Dict[str, Any]:
    return await asyncio.to_thread(_get_dashboard_stats)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_single_report(
    report_id: int,
    user: Optional[dict] = Depends(get_optional_user),
) -> Dict[str, Any]:
    report = await asyncio.to_thread(_get_report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if user and can_read_report(user, report):
        return report
    if user and not can_read_report(user, report):
        raise HTTPException(status_code=403, detail="Access denied")
    return sanitize_report_public(report)


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_single_report(
    report_id: int,
    body: UpdateReportRequest,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    allowed_fields = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not allowed_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    try:
        report = await asyncio.to_thread(_update_report, report_id, allowed_fields, user)
    except ForbiddenException as exc:
        raise HTTPException(status_code=403, detail=exc.message) from exc
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/{report_id}/upvote")
async def upvote_single_report(
    report_id: int,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    new_count = await asyncio.to_thread(_upvote_report, report_id)
    return {"upvotes": new_count}
