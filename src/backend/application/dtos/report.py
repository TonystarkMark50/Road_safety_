from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LocationPoint(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class CreateReportRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    category: str = Field(..., min_length=2, max_length=50)
    description: str = Field(..., min_length=10, max_length=5000)
    severity: str = Field(default="medium", pattern=r"^(low|medium|high|critical)$")
    location: LocationPoint
    address: str = Field(default="", max_length=500)


class UpdateReportRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    severity: Optional[str] = Field(None, pattern=r"^(low|medium|high|critical)$")
    status: Optional[str] = Field(None, pattern=r"^(under_review|assigned|in_progress|resolved|closed)$")
    assigned_to: Optional[str] = None
    assigned_department: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    ticket_id: str
    title: str
    category: str
    description: str
    severity: str
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: str = ""
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    voice_url: Optional[str] = None
    user_id: str
    upvotes: int = 0
    assigned_department: str = ""
    escalation_level: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    count: int
    next_offset: Optional[int] = None
    reports: List[Dict[str, Any]]
