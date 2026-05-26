from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from src.backend.api.dependencies.authentication import get_current_user
from src.backend.core.config import settings
from src.backend.infrastructure.database.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


def _db():
    from postgrest.exceptions import APIError
    try:
        return get_supabase_admin()
    except Exception:
        return None


def _table(name):
    db = _db()
    if db is None:
        return None
    from postgrest.exceptions import APIError
    try:
        return db.table(name)
    except APIError:
        return None


def _execute(query):
    if query is None:
        return None
    from postgrest.exceptions import APIError
    try:
        return query.execute()
    except APIError as e:
        logger.warning("Supabase query failed: %s", e)
        return None


@router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)) -> List[Dict[str, Any]]:
    result = _execute(_table("chat_conversations").select("*").eq("user_id", user["id"]).order("updated_at", desc=True).limit(50) if _table("chat_conversations") else None)
    return result.data if result else []


@router.post("/conversations")
async def create_conversation(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    t = _table("chat_conversations")
    if t is None:
        return {"id": 0, "user_id": user["id"], "title": "New Chat"}
    result = _execute(t.insert({"user_id": user["id"], "title": "New Chat"}))
    if result and result.data:
        return result.data[0]
    return {"id": 0, "user_id": user["id"], "title": "New Chat"}


@router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: int, user: dict = Depends(get_current_user)) -> List[Dict[str, Any]]:
    t = _table("chat_conversations")
    if t is None:
        return []
    conv = _execute(t.select("*").eq("id", conv_id).eq("user_id", user["id"]))
    if not conv or not conv.data:
        return []
    t2 = _table("chat_messages")
    if t2 is None:
        return []
    result = _execute(t2.select("*").eq("conversation_id", conv_id).order("created_at"))
    return result.data if result else []


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: int, body: Dict[str, str], user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    content = body.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required")

    t = _table("chat_conversations")
    if t is None:
        reply_text = await generate_ai_reply_fallback(content)
        return {"id": 0, "conversation_id": conv_id, "role": "assistant", "content": reply_text}

    conv = _execute(t.select("*").eq("id", conv_id).eq("user_id", user["id"]))
    if not conv or not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    t2 = _table("chat_messages")
    if t2:
        _execute(t2.insert({"conversation_id": conv_id, "role": "user", "content": content}))

    reply_text = await generate_ai_reply_fallback(content)

    msg_data = None
    if t2:
        msg = _execute(t2.insert({"conversation_id": conv_id, "role": "assistant", "content": reply_text}))
        if msg and msg.data:
            msg_data = msg.data[0]
        _execute(t.update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", conv_id))

    if msg_data:
        return msg_data
    return {"id": 0, "conversation_id": conv_id, "role": "assistant", "content": reply_text}


async def generate_ai_reply_fallback(content: str) -> str:
    import httpx

    if not settings.OLLAMA_API_KEY:
        return "AI assistant is not configured. Please set up OLLAMA_API_KEY."

    messages = [{"role": "system", "content": (
        "You are AccelerateZero AI — a friendly, intelligent road safety assistant. "
        "Keep responses short, clear, and helpful. Use simple language. "
        "Help users report hazards, get emergency help, find nearby services, and learn safety tips. "
        "If someone reports an emergency or accident, prioritize safety guidance immediately."
    )}, {"role": "user", "content": content}]

    if not settings.OLLAMA_API_KEY:
        return "AI assistant is not configured. Please set up OLLAMA_API_KEY."

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.OLLAMA_API_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"},
                json={"model": settings.AI_MODEL, "messages": messages, "temperature": 0.3},
                timeout=30,
            )
            resp.raise_for_status()
            result = resp.json()
            return result["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.warning("AI chat generation failed: %s", exc)
        return "Sorry, I'm having trouble processing that request right now. Please try again in a moment."
