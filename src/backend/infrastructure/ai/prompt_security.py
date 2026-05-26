from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

ALLOWED_CONTEXT_KEYS = frozenset({"page", "report_id", "severity", "emergency", "location"})
INJECTION_PATTERNS = re.compile(
    r"(?i)(ignore\s+(all\s+)?(previous|prior)\s+instructions|"
    r"disregard\s+(the\s+)?system\s+prompt|"
    r"you\s+are\s+now\s+|"
    r"reveal\s+(the\s+)?(system|hidden)\s+prompt|"
    r"jailbreak|DAN\s+mode|"
    r"<\s*/?\s*system\s*>|"
    r"```\s*system)",
)
CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_user_message(message: str, max_length: int = 2000) -> str:
    cleaned = CONTROL_CHARS.sub("", message or "").strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    if INJECTION_PATTERNS.search(cleaned):
        raise ValueError("Message contains disallowed content")
    return cleaned


def sanitize_context(context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not context:
        return {}
    safe: Dict[str, Any] = {}
    for key in ALLOWED_CONTEXT_KEYS:
        if key not in context:
            continue
        val = context[key]
        if key == "page" and isinstance(val, str):
            safe["page"] = val[:64]
        elif key == "report_id" and val is not None:
            safe["report_id"] = str(val)[:32]
        elif key == "severity" and isinstance(val, str):
            safe["severity"] = val[:32]
        elif key == "emergency" and isinstance(val, bool):
            safe["emergency"] = val
        elif key == "location" and isinstance(val, str):
            safe["location"] = val[:256]
    return safe


def cap_history(messages: List[Dict[str, str]], limit: int = 10) -> List[Dict[str, str]]:
    return messages[-limit:] if len(messages) > limit else messages
