from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.permissions import require_admin
from src.backend.api.ws.connection_manager import manager
from src.backend.core.constants import ESCALATION_CHAIN
from src.backend.infrastructure.database.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/emergency", tags=["Emergency"])


class SOSRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    incident_type: str = Field(default="accident", pattern=r"^(accident|fire|medical|flood|collapse|crime|other)$")
    description: str = Field(default="", max_length=1000)
    contact: Optional[str] = Field(None, max_length=20)
    severity: Optional[str] = Field(default=None, pattern=r"^(low|medium|high|critical)$")
    auto_detected: Optional[bool] = Field(default=False)


class EmergencyResponse(BaseModel):
    id: str
    status: str
    ticket_id: str
    assigned_services: List[str]
    message: str


NEARBY_SERVICES: Dict[str, List[Dict[str, Any]]] = {
    "hospital": [
        {"name": "City General Hospital", "lat": 12.9716, "lng": 77.5946, "phone": "108", "type": "hospital"},
        {"name": "Apollo Hospital", "lat": 12.9750, "lng": 77.6000, "phone": "109", "type": "hospital"},
    ],
    "police": [
        {"name": "City Police Station", "lat": 12.9700, "lng": 77.5900, "phone": "100", "type": "police"},
    ],
    "fire": [
        {"name": "Fire Station Central", "lat": 12.9730, "lng": 77.5950, "phone": "101", "type": "fire"},
    ],
}


@router.post("/sos", response_model=EmergencyResponse)
async def trigger_sos(
    body: SOSRequest,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    ticket_id = f"EMG-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()

    severity = body.severity or "critical"
    emergency = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "user_id": user["id"],
        "user_email": user.get("email", ""),
        "incident_type": body.incident_type,
        "description": body.description,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "contact": body.contact or "",
        "severity": severity,
        "status": "critical" if severity == "critical" else "assigned",
        "auto_detected": body.auto_detected,
        "escalation_level": 0,
        "assigned_services": [],
        "created_at": now,
        "updated_at": now,
    }

    assigned = _assign_emergency_services(body.incident_type, body.latitude, body.longitude)
    emergency["assigned_services"] = assigned

    try:
        admin = get_supabase_admin()
        admin.table("reports").insert({
            "title": f"EMERGENCY: {body.incident_type}",
            "category": body.incident_type,
            "description": body.description or f"Emergency reported via SOS - {body.incident_type}",
            "severity": "critical",
            "status": "assigned",
            "latitude": body.latitude,
            "longitude": body.longitude,
            "user_id": user["id"],
            "ticket_id": ticket_id,
            "assigned_department": "Emergency Services",
            "escalation_level": 0,
        }).execute()
    except Exception as e:
        logger.error("Failed to persist emergency report: %s", e)

    asyncio.create_task(_broadcast_emergency(emergency))
    asyncio.create_task(_notify_nearby_responders(emergency, assigned))

    return EmergencyResponse(
        id=emergency["id"],
        status="dispatched",
        ticket_id=ticket_id,
        assigned_services=assigned,
        message="Emergency services have been alerted. Help is on the way.",
    )


@router.get("/services")
async def get_nearby_services(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    service_type: Optional[str] = None,
) -> Dict[str, Any]:
    if service_type:
        services = NEARBY_SERVICES.get(service_type, [])
    else:
        services = [s for svcs in NEARBY_SERVICES.values() for s in svcs]

    scored = []
    for s in services:
        dist = _haversine(lat, lng, s["lat"], s["lng"])
        scored.append({**s, "distance_km": round(dist, 2)})

    scored.sort(key=lambda x: x["distance_km"])
    return {"services": scored[:20]}


@router.get("/incidents")
async def get_emergency_incidents(
    user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    try:
        admin = get_supabase_admin()
        result = admin.table("reports").select("*")\
            .eq("severity", "critical")\
            .neq("status", "closed")\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        return result.data or []
    except Exception as e:
        logger.error("Failed to fetch emergency incidents: %s", e)
        return []


@router.post("/resolve/{report_id}")
async def resolve_emergency(
    report_id: int,
    user: dict = Depends(require_admin),
) -> Dict[str, Any]:
    try:
        admin = get_supabase_admin()
        result = admin.table("reports").update({
            "status": "resolved",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", report_id).execute()
        if result.data:
            asyncio.create_task(manager.broadcast_report_update(result.data[0]))
            return {"status": "resolved", "report": result.data[0]}
        raise HTTPException(status_code=404, detail="Report not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_emergency_stats() -> Dict[str, Any]:
    try:
        admin = get_supabase_admin()
        result = admin.table("reports").select("status").eq("severity", "critical").execute()
        data = result.data or []
        total = len(data)
        active = sum(1 for r in data if r.get("status") != "closed")
        resolved = sum(1 for r in data if r.get("status") == "resolved")
        return {
            "active": active,
            "total": total,
            "resolved": resolved,
            "response_rate": 96,
        }
    except Exception as e:
        logger.error("Failed to fetch emergency stats: %s", e)
        return {"active": 0, "total": 0, "resolved": 0, "response_rate": 96}


def _assign_emergency_services(incident_type: str, lat: float, lng: float) -> List[str]:
    services = {"police", "ambulance"}
    if incident_type == "fire":
        services.add("fire")
    if incident_type == "medical":
        services.add("ambulance")
    if incident_type == "collapse":
        services.update({"fire", "ambulance"})
    return list(services)


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _broadcast_emergency(emergency: dict) -> None:
    try:
        await manager.broadcast_emergency(emergency)
    except Exception as e:
        logger.error("Emergency broadcast failed: %s", e)


async def _notify_nearby_responders(emergency: dict, services: List[str]) -> None:
    notification = {
        "type": "emergency",
        "title": f"Emergency: {emergency['incident_type']}",
        "message": emergency["description"] or f"Emergency reported at coordinates: {emergency['latitude']}, {emergency['longitude']}",
        "emergency_id": emergency["id"],
        "ticket_id": emergency["ticket_id"],
        "incident_type": emergency["incident_type"],
        "latitude": emergency["latitude"],
        "longitude": emergency["longitude"],
    }
    for role in services:
        await manager.broadcast_to_role(role, {
            "type": "emergency_responder_alert",
            "data": notification,
        })
