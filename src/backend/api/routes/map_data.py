from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.infrastructure.database.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/map", tags=["Map"])


@router.get("/incidents")
async def get_map_incidents(
    ne_lat: Optional[float] = Query(None, ge=-90, le=90),
    ne_lng: Optional[float] = Query(None, ge=-180, le=180),
    sw_lat: Optional[float] = Query(None, ge=-90, le=90),
    sw_lng: Optional[float] = Query(None, ge=-180, le=180),
    severity: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        admin = get_supabase_admin()
        query = admin.table("reports").select(
            "id,ticket_id,title,category,severity,status,latitude,longitude,address,upvotes,assigned_department,created_at"
        )

        if ne_lat and ne_lng and sw_lat and sw_lng:
            query = query.lte("latitude", ne_lat).gte("latitude", sw_lat)
            query = query.lte("longitude", ne_lng).gte("longitude", sw_lng)

        if severity:
            query = query.eq("severity", severity)
        if category:
            query = query.eq("category", category)
        if status:
            query = query.eq("status", status)

        result = query.limit(limit).order("created_at", desc=True).execute()
        incidents = result.data or []

        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [inc["longitude"], inc["latitude"]],
                    },
                    "properties": {
                        "id": inc["id"],
                        "ticket_id": inc.get("ticket_id", ""),
                        "title": inc.get("title", ""),
                        "category": inc.get("category", ""),
                        "severity": inc.get("severity", "medium"),
                        "status": inc.get("status", "submitted"),
                        "address": inc.get("address", ""),
                        "upvotes": inc.get("upvotes", 0),
                        "department": inc.get("assigned_department", ""),
                        "created_at": inc.get("created_at", ""),
                    },
                }
                for inc in incidents
                if inc.get("latitude") and inc.get("longitude")
            ],
            "count": len(incidents),
        }
    except Exception as e:
        logger.error("Failed to fetch map incidents: %s", e)
        return {"type": "FeatureCollection", "features": [], "count": 0}


@router.get("/heatmap")
async def get_heatmap_data(
    ne_lat: Optional[float] = Query(None, ge=-90, le=90),
    ne_lng: Optional[float] = Query(None, ge=-180, le=180),
    sw_lat: Optional[float] = Query(None, ge=-90, le=90),
    sw_lng: Optional[float] = Query(None, ge=-180, le=180),
    days: int = Query(30, ge=1, le=365),
) -> Dict[str, Any]:
    try:
        admin = get_supabase_admin()
        query = admin.table("reports").select("latitude,longitude,severity,created_at")

        if ne_lat and ne_lng and sw_lat and sw_lng:
            query = query.lte("latitude", ne_lat).gte("latitude", sw_lat)
            query = query.lte("longitude", ne_lng).gte("longitude", sw_lng)

        result = query.limit(5000).execute()
        points = result.data or []

        heat_points = []
        for p in points:
            if p.get("latitude") and p.get("longitude"):
                weight = {"critical": 1.0, "high": 0.7, "medium": 0.4, "low": 0.2}.get(
                    p.get("severity", "medium"), 0.4
                )
                heat_points.append({
                    "lat": p["latitude"],
                    "lng": p["longitude"],
                    "weight": weight,
                })

        return {"points": heat_points, "count": len(heat_points)}
    except Exception as e:
        logger.error("Failed to fetch heatmap data: %s", e)
        return {"points": [], "count": 0}


@router.get("/stats")
async def get_map_stats() -> Dict[str, Any]:
    try:
        admin = get_supabase_admin()
        result = admin.table("reports").select("severity,status,category").limit(10000).execute()
        data = result.data or []

        total = len(data)
        by_severity: Dict[str, int] = {}
        by_category: Dict[str, int] = {}
        active = 0

        for r in data:
            sev = r.get("severity", "unknown")
            by_severity[sev] = by_severity.get(sev, 0) + 1
            cat = r.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + 1
            if r.get("status") not in ("resolved", "closed"):
                active += 1

        return {
            "total": total,
            "active": active,
            "resolved": total - active,
            "by_severity": by_severity,
            "by_category": by_category,
        }
    except Exception as e:
        logger.error("Failed to fetch map stats: %s", e)
        return {"total": 0, "active": 0, "resolved": 0}


@router.get("/nearby")
async def get_nearby_reports(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.1, le=100),
    limit: int = Query(50, ge=1, le=200),
) -> List[Dict[str, Any]]:
    try:
        admin = get_supabase_admin()
        result = admin.table("reports").select("*")\
            .neq("status", "closed")\
            .limit(500)\
            .execute()
        reports = result.data or []

        nearby = []
        for r in reports:
            if not r.get("latitude") or not r.get("longitude"):
                continue
            dist = _haversine(lat, lng, r["latitude"], r["longitude"])
            if dist <= radius_km:
                r["distance_km"] = round(dist, 2)
                nearby.append(r)

        nearby.sort(key=lambda x: x.get("distance_km", 999))
        return nearby[:limit]
    except Exception as e:
        logger.error("Failed to fetch nearby reports: %s", e)
        return []


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
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
