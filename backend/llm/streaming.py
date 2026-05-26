"""Shared SSE streaming helpers for LLM-backed endpoints."""

import json
import uuid
from collections.abc import AsyncIterator, Callable

from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from llm.openrouter import stream_chat
from llm.pricing import compute_cost
from llm.quota import QuotaStatus
from llm.usage import log_usage_event
from models.users import User

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


async def stream_llm_to_sse(
    *,
    model: str,
    messages: list[dict[str, str]],
    problem_id: uuid.UUID | None = None,
    max_tokens: int | None = None,
    quota_status: QuotaStatus | None = None,
    on_complete: Callable[[str, dict | None], dict] | None = None,
) -> AsyncIterator[str]:
    """Yield SSE lines; optional on_complete builds extra done payload fields."""
    parts: list[str] = []
    usage_meta: dict | None = None
    total_tokens = 0

    async for token, usage in stream_chat(model=model, messages=messages, max_tokens=max_tokens):
        if usage is not None:
            usage_meta = usage
            continue
        if token:
            parts.append(token)
            total_tokens += max(1, len(token.split()))
            yield f"data: {json.dumps({'token': token})}\n\n"

    full_text = "".join(parts)
    if usage_meta:
        input_tokens = int(usage_meta.get("prompt_tokens") or usage_meta.get("input_tokens") or 0)
        output_tokens = int(usage_meta.get("completion_tokens") or usage_meta.get("output_tokens") or 0)
        total_tokens = input_tokens + output_tokens or total_tokens
        cost = float(usage_meta.get("cost") or 0.0)
        if cost == 0.0 and (input_tokens > 0 or output_tokens > 0):
            cost = compute_cost(model, input_tokens, output_tokens)
    else:
        input_tokens = 0
        output_tokens = 0
        cost = 0.0

    done: dict = {
        "type": "done",
        "model": model,
        "tokens_used": total_tokens,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost,
    }
    if quota_status is not None:
        done["calls_remaining"] = max(0, quota_status.calls_limit - quota_status.calls_used - 1)
        if quota_status.pct_used >= 0.8:
            done["quota_warning"] = True
    if on_complete:
        done.update(on_complete(full_text, usage_meta))

    yield f"data: {json.dumps(done)}\n\n"


async def stream_static_to_sse(text: str) -> AsyncIterator[str]:
    """Yield pre-written text as SSE tokens (no LLM call)."""
    if text:
        yield f"data: {json.dumps({'token': text})}\n\n"
    done = {
        "type": "done",
        "model": "stored",
        "tokens_used": 0,
        "cost_usd": 0.0,
        "source": "stored",
    }
    yield f"data: {json.dumps(done)}\n\n"


def sse_response(
    generator: AsyncIterator[str],
) -> StreamingResponse:
    return StreamingResponse(generator, media_type="text/event-stream", headers=SSE_HEADERS)


def log_stream_usage(
    db: Session,
    *,
    user: User,
    event_type: str,
    prompt_name: str,
    model: str,
    tokens_used: int,
    cost_usd: float,
    input_tokens: int = 0,
    output_tokens: int = 0,
    problem_id: uuid.UUID | None = None,
) -> None:
    log_usage_event(
        db,
        user=user,
        event_type=event_type,
        prompt_name=prompt_name,
        llm_model=model,
        tokens_used=tokens_used,
        cost_usd=cost_usd,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        problem_id=problem_id,
    )
