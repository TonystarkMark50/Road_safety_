from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.api.dependencies.rate_limiter import rate_limit
from src.backend.infrastructure.ai.prompt_security import (
    sanitize_user_message,
    sanitize_context,
    cap_history,
)
from src.backend.core.config import settings
from src.backend.infrastructure.database.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI"])


SYSTEM_PROMPT = """You are AccelerateZero AI, a calm and helpful road safety assistant for India.

YOUR ROLE:
- Help users report road hazards, find emergency services, get safety guidance, and use the platform.
- In emergencies, advise calling 100 (Police), 101 (Fire), or 108 (Ambulance).
- Never give medical or legal advice. Protect user privacy.

RESPONSE RULES:
- Speak directly to the user. Only output what you would say to them.
- Keep responses short and clear. Use simple English.
- Be warm on first contact. Ask one question at a time.
- Understand typos and slang.

Your output must contain ONLY the words you say to the user. No explanations, no planning, no self-talk, no meta-commentary."""


QUICK_ACTIONS = [
    {"id": "report_hazard", "label": "Report Hazard", "icon": "exclamation-triangle"},
    {"id": "emergency", "label": "Emergency Help", "icon": "sos", "urgent": True},
    {"id": "nearby_hospitals", "label": "Nearby Hospitals", "icon": "hospital"},
    {"id": "safety_tips", "label": "Safety Tips", "icon": "shield-halved"},
    {"id": "contact_support", "label": "Contact Support", "icon": "headset"},
]


CONTEXT_CACHE: Dict[str, tuple] = {}
CONTEXT_CACHE_TTL = 3600


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None


class QuickActionResponse(BaseModel):
    actions: List[Dict[str, Any]]


@router.get("/quick-actions")
async def get_quick_actions() -> QuickActionResponse:
    return QuickActionResponse(actions=QUICK_ACTIONS)


@router.post("/chat/stream")
async def stream_chat(
    body: ChatRequest,
    request: Request,
    user: dict = Depends(get_current_user),
    _: None = Depends(rate_limit("ai")),
):
    return StreamingResponse(
        _stream_ai_response(body.message, body.conversation_id, body.context, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/classify")
async def classify_report(
    title: str,
    description: str,
    user: dict = Depends(get_current_user),
    _: None = Depends(rate_limit("ai")),
) -> Dict[str, Any]:
    prompt = f"""Classify this road hazard report:
Title: {title}
Description: {description}

Return JSON with:
- category: pothole|road_damage|signal_failure|waterlogging|illegal_parking|congestion|accident|other
- severity: low|medium|high|critical
- confidence: 0.0-1.0
- department: suggested department name
- tags: array of relevant keywords"""

    try:
        result = await _call_ollama(prompt, temperature=0.1)
        parsed = json.loads(result)
        return {
            "category": parsed.get("category", "other"),
            "severity": parsed.get("severity", "medium"),
            "confidence": parsed.get("confidence", 0.5),
            "department": parsed.get("department", "Municipality"),
            "tags": parsed.get("tags", []),
        }
    except Exception as e:
        logger.warning("AI classification failed: %s", e)
        return {
            "category": "other",
            "severity": "medium",
            "confidence": 0.0,
            "department": "Municipality",
            "tags": [],
        }


@router.post("/analyze/trends")
async def analyze_trends(
    data: Dict[str, Any],
    user: dict = Depends(get_current_user),
    _: None = Depends(rate_limit("ai")),
) -> Dict[str, Any]:
    reports_summary = data.get("reports", [])
    prompt = f"""Analyze these road hazard reports and provide insights.
Reports count: {len(reports_summary)}

Return JSON with:
- trend: increasing|decreasing|stable
- top_categories: array of {category: count}
- recommendation: brief actionable recommendation
- risk_factors: array of risk factor strings"""

    try:
        result = await _call_ollama(prompt, temperature=0.2)
        parsed = json.loads(result)
        return {
            "trend": parsed.get("trend", "stable"),
            "top_categories": parsed.get("top_categories", []),
            "recommendation": parsed.get("recommendation", ""),
            "risk_factors": parsed.get("risk_factors", []),
        }
    except Exception as e:
        logger.warning("AI trend analysis failed: %s", e)
        return {"trend": "stable", "top_categories": [], "recommendation": "", "risk_factors": []}


def require_elevated(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "authority", "emergency"):
        raise HTTPException(status_code=403, detail="Elevated access required")
    return user


@router.post("/suggest/response")
async def suggest_response(
    report: Dict[str, Any],
    user: dict = Depends(require_elevated),
) -> Dict[str, Any]:
    prompt = f"""Generate a clear response for this road hazard report:
Title: {report.get('title', '')}
Category: {report.get('category', '')}
Severity: {report.get('severity', '')}
Description: {report.get('description', '')}

Provide:
1. suggested_response: clear response for the citizen
2. estimated_resolution_time: estimated time in hours
3. required_departments: list of departments to involve
4. priority_score: 1-10"""

    try:
        result = await _call_ollama(prompt, temperature=0.2)
        parsed = json.loads(result)
        return {
            "suggested_response": parsed.get("suggested_response", ""),
            "estimated_resolution_time": parsed.get("estimated_resolution_time", 48),
            "required_departments": parsed.get("required_departments", []),
            "priority_score": parsed.get("priority_score", 5),
        }
    except Exception as e:
        logger.warning("AI response suggestion failed: %s", e)
        return {"suggested_response": "", "estimated_resolution_time": 48, "required_departments": [], "priority_score": 5}


async def _stream_ai_response(
    message: str,
    conversation_id: Optional[int],
    context: Optional[Dict[str, Any]],
    user: Optional[dict],
) -> AsyncGenerator[str, None]:
    start_time = time.monotonic()
    token_count = 0
    full_response_parts: list[str] = []

    try:
        message = sanitize_user_message(message)
        context = sanitize_context(context)
    except ValueError as exc:
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'start', 'conversation_id': conversation_id})}\n\n"

    messages = _build_messages(message, conversation_id, context, user)

    try:
        if not settings.OLLAMA_API_KEY:
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI assistant is not configured (OLLAMA_API_KEY missing). Please contact support.'})}\n\n"
            return
        if settings.OLLAMA_API_KEY == "ollama":
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI assistant is unavailable — the model API key needs to be configured.'})}\n\n"
            return

        if context and context.get("emergency", False):
            yield f"data: {json.dumps({'type': 'action', 'action': 'emergency_protocol', 'message': 'This appears to be an emergency. Please call 100 (Police), 101 (Fire), or 108 (Ambulance) immediately.'})}\n\n"

        async with asyncio.timeout(30):
            async for token in _stream_ollama(messages):
                if token:
                    token_count += 1
                    full_response_parts.append(token)
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        full_response = _sanitize_response("".join(full_response_parts))

        if token_count > 5:
            cache_key = _get_cache_key(message, context)
            CONTEXT_CACHE[cache_key] = (full_response, time.monotonic())

        if conversation_id and user:
            _persist_conversation(conversation_id, message, full_response)

        elapsed = time.monotonic() - start_time
        suggestions = _generate_suggestions(message)

        yield f"data: {json.dumps({
            'type': 'done',
            'tokens': token_count,
            'elapsed_ms': round(elapsed * 1000),
            'suggestions': suggestions,
        })}\n\n"

    except asyncio.TimeoutError:
        yield f"data: {json.dumps({'type': 'error', 'message': 'The assistant is taking longer than usual. Please try again.'})}\n\n"
    except Exception as e:
        logger.error("AI stream error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'message': "I'm temporarily unable to process that request. Please try again in a moment."})}\n\n"


def _persist_conversation(conversation_id: int, user_message: str, assistant_response: str) -> None:
    try:
        admin = get_supabase_admin()
        admin.table("chat_messages").insert([
            {"conversation_id": conversation_id, "role": "user", "content": user_message},
            {"conversation_id": conversation_id, "role": "assistant", "content": assistant_response},
        ]).execute()
        admin.table("chat_conversations").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", conversation_id).execute()
    except Exception:
        logger.warning("Failed to persist conversation", exc_info=True)


def _build_messages(
    message: str,
    conversation_id: Optional[int],
    context: Optional[Dict[str, Any]],
    user: Optional[dict],
) -> List[Dict[str, str]]:
    system = SYSTEM_PROMPT
    if user:
        role_info = f"The user is a {user.get('role', 'citizen')}."
        system = f"{system}\n\n{role_info}"
    if context:
        if context.get("page"):
            system += f"\nThe user is on the {context['page']} page."
        if context.get("report_id"):
            system += f"\nThey are asking about report #{context['report_id']}."
        if context.get("severity"):
            system += f"\nReport severity context: {context['severity']}."
        if context.get("location"):
            system += f"\nTheir location: {context['location']}"

    messages = [{"role": "system", "content": system}]

    if conversation_id and user:
        try:
            admin = get_supabase_admin()
            result = admin.table("chat_messages").select("role,content").eq("conversation_id", conversation_id).order("created_at").limit(20).execute()
            history = result.data or []
            for h in cap_history(history, 10):
                content = h.get("content", "")
                if h.get("role") in ("user", "assistant") and content:
                    messages.append({"role": h["role"], "content": content[:2000]})
        except Exception:
            pass

    messages.append({"role": "user", "content": message})
    return messages


async def _stream_ollama(messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
    import httpx

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"},
            json={
                "model": settings.AI_MODEL,
                "messages": messages,
                "temperature": 0.5,
                "max_tokens": 1024,
                "stream": True,
            },
            timeout=30,
        ) as resp:
            if resp.status_code != 200:
                fallback = _sanitize_response(_generate_fallback_response(messages[-1]["content"]))
                yield fallback
                return

            async for line in resp.aiter_lines():
                if not line.startswith("data: ") or line.strip() == "data: [DONE]":
                    continue
                try:
                    data = json.loads(line[6:])
                    delta = data.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content and ("Cannot read" in content or "does not support" in content):
                        logger.warning("Model returned capability error: %s", content)
                        fallback = _sanitize_response(_generate_fallback_response(messages[-1]["content"]))
                        yield fallback
                        return
                    if content:
                        yield content
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue


async def _call_ollama(prompt: str, temperature: float = 0.3) -> str:
    import httpx

    if not settings.OLLAMA_API_KEY:
        return json.dumps({"error": "AI not configured"})

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.OLLAMA_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"},
            json={
                "model": settings.AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": 512,
            },
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()
        return result["choices"][0]["message"]["content"]


def _sanitize_response(text: str) -> str:
    if not text or not text.strip():
        return text

    lines = text.split("\n")
    filtered = []

    meta_instruction_patterns = re.compile(
        r"(?i)(we need to|we should|we must|we can|"
        r"the assistant should|the response should|the answer should|"
        r"the system will|the model will|"
        r"i need to|i should|i must|i will now|"
        r"my response must|my answer should|"
        r"output only|output just|respond with only|"
        r"say only|reply with only|"
        r"keep it to|make sure to|"
        r"ensure (the|that|we)|"
        r"ask one (question|thing)|"
        r"this is a (greeting|response|follow.up)|"
        r"that's (a|an|the) (greeting|question|warm|friendly|response|answer)|"
        r"it'?s (a|an|the|one) (question|thing|answer|response)|"
        r"so (we|the|i|my) (need|should|must|can|will|respond|say|output)|"
        r"check(ing)? (rules|output|instruction|format)|"
        r"reasoning[.:]|thinking[.:]|analysis[.:]|"
        r"chain\s*of\s*thought|"
        r"internal\s*(note|instruction|thought|prompt)|"
        r"system\s*prompt|hidden\s*prompt|"
        r"developer\s*(note|instruction)|"
        r"scratchpad|planning:|"
        r"self\.reminder|safety\s+note:|tone\s+check:|"
        r"meta[.:]|meta\.commentary|"
        r"follow\s*ing\s*(rule|instruction|format)|"
        r"probably\s+(ask|say|respond|okay)|"
        r"so\s+final\s+answer|the\s+final\s+answer|"
        r"\\\*mental\s*note\\\*|\\\\\*checks\\\\\*|\\\\\*remembers\\\\\*|"
        r"just\s+practical|"
        r"single\s*threaded|"
        r"avoid\s*ing\s+confusion|"
        r"no\s+(extra|bullet|markdown|formatting)|"
        r"they\.re\s+(likely|probably|trying)|"
        r"^thus\s*:|"
        r"important\s*:\s*must\s+not|must\s+not\s+repeat|"
        r"solution\.ori|"
        r"^good[.!]*$|^perfect[.!]*$|^exactly[.!]*$|"
        r"^okay[.!]*$|^hmm[.!]*$|^wait[.!]*$|"
        r"^phew[.!]*$|^nope[.!]*$|^aha[.!]*$)",
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            filtered.append(line)
            continue
        if stripped.startswith("```") or stripped.startswith("**"):
            continue
        if meta_instruction_patterns.search(stripped):
            continue
        filtered.append(line)

    result = "\n".join(filtered).strip()

    if not result:
        final_lines = [l for l in text.split("\n") if l.strip()]
        if final_lines:
            result = final_lines[-1]

    return result if result else "I'm sorry, I couldn't process that properly. Please try again."


def _generate_fallback_response(message: str) -> str:
    msg_lower = message.lower()
    if any(w in msg_lower for w in ["emergency", "accident", "fire", "hurt", "help"]):
        return "⚠️ Are you safe right now?\n\nIf you need immediate help:\n• **Call 100** — Police\n• **Call 101** — Fire\n• **Call 108** — Ambulance\n\nTo report through AccelerateZero:\n1. Tap **Report** in the menu\n2. Select 'accident' or 'emergency'\n3. Set severity to **Critical**\n4. Share your exact location\n\nI can also help find nearby hospitals or police stations if you need."
    if any(w in msg_lower for w in ["pothole", "road", "damage", "hazard"]):
        return "I can help you report that! Here's how:\n\n1. Go to the **Report** page\n2. Pick the right category (pothole, road damage, etc.)\n3. Choose severity level\n4. Add a short description and location\n\nYour report goes directly to the right department. You can track it anytime on the **Track** page."
    if any(w in msg_lower for w in ["track", "status", "where", "progress", "ticket"]):
        return "To check your report status:\n\n1. Go to the **Track** page\n2. Enter your ticket ID (starts with RD-)\n3. You'll see the current status and which department is handling it\n\nStatus flow: **Submitted** → **Under Review** → **Assigned** → **In Progress** → **Resolved** → **Closed**"
    return "Hello! 👋 How can I assist you today? You can report a road hazard, get emergency help, find nearby hospitals, or check road safety tips."


def _generate_suggestions(message: str) -> List[str]:
    msg_lower = message.lower()
    if any(w in msg_lower for w in ["pothole", "road", "damage", "hazard"]):
        return ["How do I report a pothole?", "What department handles road damage?", "How long until it's fixed?", "Safety tips for that area"]
    if any(w in msg_lower for w in ["emergency", "accident", "fire", "hurt", "crash"]):
        return ["Call 108 (Ambulance)", "Call 100 (Police)", "Find nearby hospital", "Report on the platform"]
    if any(w in msg_lower for w in ["track", "ticket", "status", "progress"]):
        return ["Track my report", "What does 'under review' mean?", "How to escalate?", "My ticket ID"]
    if any(w in msg_lower for w in ["safety", "tip", "awareness"]):
        return ["Road safety for pedestrians", "Safe driving tips", "Vehicle safety check", "What to do after an accident"]
    if any(w in msg_lower for w in ["hospital", "police", "ambulance", "nearby"]):
        return ["Find hospitals near me", "Find police stations", "Call ambulance", "Emergency help"]
    return ["Report a hazard", "Emergency help", "Safety tips", "Find nearby hospitals"]


def _get_cache_key(message: str, context: Optional[Dict[str, Any]]) -> str:
    if context and context.get("report"):
        return f"report_{context['report']['id']}:{message[:50]}"
    return message[:100]


def _chunk_text(text: str, words_per_chunk: int = 3) -> List[str]:
    words = text.split()
    return [" ".join(words[i:i + words_per_chunk]) for i in range(0, len(words), words_per_chunk)]
