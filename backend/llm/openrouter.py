"""OpenRouter chat completions with SSE streaming."""

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
from fastapi import HTTPException, status

from core.config import settings

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"


def _headers() -> dict[str, str]:
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENROUTER_API_KEY is not configured",
        )
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.frontend_url,
        "X-Title": settings.app_name,
    }


async def stream_chat(
    *,
    model: str,
    messages: list[dict[str, str]],
) -> AsyncIterator[tuple[str, dict[str, Any] | None]]:
    """
    Yield (token_text, usage_dict) tuples.
    Final yield has empty token and usage dict from OpenRouter (if present).
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            OPENROUTER_CHAT_URL,
            headers=_headers(),
            json=payload,
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"OpenRouter error {response.status_code}: {body.decode()[:500]}",
                )

            usage: dict[str, Any] | None = None
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue

                if chunk.get("usage"):
                    usage = chunk["usage"]

                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content, None

            yield "", usage
