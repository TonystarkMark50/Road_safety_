from __future__ import annotations

import httpx
import logging
from typing import Any, Dict, List, Optional
from src.backend.core.config import settings

logger = logging.getLogger(__name__)


async def classify_report(title: str, description: str) -> Dict[str, Any]:
    prompt = (
        f"Classify the following road hazard report:\n"
        f"Title: {title}\nDescription: {description}\n"
        "Return a JSON object with: category, severity, e.g. "
        '{"category": "pothole", "severity": "high"}'
    )
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.OLLAMA_API_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"},
                json={
                    "model": "nemotron-3-super:cloud",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a hazard classifier. Return only valid JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                },
                timeout=15,
            )
            resp.raise_for_status()
            result = resp.json()
            content = result["choices"][0]["message"]["content"]
            import json
            return json.loads(content)
    except Exception as exc:
        logger.warning("Ollama classification failed: %s", exc)
        return {"category": "other", "severity": "medium"}


async def generate_summary(reports: List[Dict[str, Any]]) -> str:
    briefs = "\n".join(
        f"- {r.get('title', 'Untitled')} [{r.get('status', 'unknown')}]"
        for r in reports[:10]
    )
    prompt = f"Summarize these road safety reports:\n{briefs}\nKeep it under 3 sentences."
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.OLLAMA_API_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"},
                json={
                    "model": "nemotron-3-super:cloud",
                    "messages": [
                        {"role": "system", "content": "You are a safety analyst."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.warning("Ollama summary generation failed: %s", exc)
        return "Summary unavailable."
