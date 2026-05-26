from __future__ import annotations

from enum import Enum
from typing import Dict, FrozenSet, List, Tuple


class UserRole(str, Enum):
    CITIZEN = "citizen"
    ADMIN = "admin"
    AUTHORITY = "authority"
    EMERGENCY = "emergency"

    @classmethod
    def elevated(cls) -> FrozenSet[str]:
        return frozenset({cls.ADMIN, cls.AUTHORITY, cls.EMERGENCY})

    @classmethod
    def all(cls) -> FrozenSet[str]:
        return frozenset({cls.CITIZEN, cls.ADMIN, cls.AUTHORITY, cls.EMERGENCY})


class ReportStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

    @classmethod
    def active(cls) -> FrozenSet[str]:
        return frozenset({cls.SUBMITTED, cls.UNDER_REVIEW, cls.ASSIGNED, cls.IN_PROGRESS})

    @classmethod
    def terminal(cls) -> FrozenSet[str]:
        return frozenset({cls.RESOLVED, cls.CLOSED})


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EmergencyServiceType(str, Enum):
    HOSPITAL = "hospital"
    POLICE = "police"
    FIRE = "fire"
    AMBULANCE = "ambulance"


class NotificationType(str, Enum):
    GENERAL = "general"
    REPORT_UPDATE = "report_update"
    EMERGENCY = "emergency"
    ESCALATION = "escalation"


DEPARTMENT_ROUTING: Dict[str, str] = {
    "pothole": "PWD",
    "road_damage": "PWD",
    "signal_failure": "Traffic Police",
    "waterlogging": "Municipality",
    "illegal_parking": "Traffic Police",
    "congestion": "Traffic Police",
    "accident": "Police",
    "other": "Municipality",
}

ESCALATION_CHAIN: List[str] = [
    "Municipality",
    "PWD",
    "District Administration",
    "State Government",
]

ALLOWED_UPLOAD_MIME_TYPES: Dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
}

REPORT_LIST_FIELDS: str = "id,ticket_id,title,category,severity,status,address,upvotes,assigned_department,created_at"

RATE_LIMIT_PATTERNS: List[Tuple[str, int, int]] = [
    (r"^/api/v1/auth/login", 10, 60),
    (r"^/api/v1/auth/register", 5, 300),
    (r"^/api/v1/auth/refresh", 20, 60),
    (r"^/api/v1/auth/verify-otp", 10, 300),
    (r"^/api/v1/emergency/sos", 5, 60),
    (r"^/api/v1/ai/", 30, 60),
    (r"^/api/v1/reports/\d+/upvote", 30, 60),
    (r"^/api/v1/media/upload", 20, 60),
    (r"^/api/v1/reports", 60, 60),
    (r"^/api/v1/.*", 200, 60),
]

NAMED_RATE_LIMITS: Dict[str, Tuple[int, int]] = {
    "default": (200, 60),
    "login": (10, 60),
    "register": (5, 300),
    "refresh": (20, 60),
    "ai": (30, 60),
}

SECURITY_HEADERS: Dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(self), camera=(self), microphone=(self)",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
}

CSP_HEADER: str = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://unpkg.com/leaflet@1.9.4/dist/leaflet.js https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com/leaflet@1.9.4/dist/leaflet.css https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org; "
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://localhost:8000 http://localhost:8000 ws://localhost:8000 https://*.tile.openstreetmap.org; "
    "frame-src 'none'; "
    "object-src 'none'; "
    "worker-src 'self' blob:"
)
