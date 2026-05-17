"""LLM streaming endpoints (OpenRouter SSE passthrough)."""

import json
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from llm.openrouter import stream_chat
from llm.registry import load_and_render
from llm.router import resolve_model
from llm.usage import log_usage_event
from models.users import User
from schemas.llm import LLMStreamRequest

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/stream")
async def stream_llm(
    body: LLMStreamRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """
    LLM-01/03: Render a DB prompt and stream the OpenRouter response as SSE.
    Events: data: {"token": "..."} then data: {"type": "done", ...}
    """
    rendered = load_and_render(db, body.prompt_name, body.variables)
    model = resolve_model(db, current_user, body.model)
    messages = [{"role": "user", "content": rendered}]

    async def event_generator():
        total_tokens = 0
        usage_meta: dict | None = None

        async for token, usage in stream_chat(model=model, messages=messages):
            if usage is not None:
                usage_meta = usage
                continue
            if token:
                total_tokens += max(1, len(token.split()))
                yield f"data: {json.dumps({'token': token})}\n\n"

        if usage_meta:
            total_tokens = int(
                usage_meta.get("total_tokens")
                or usage_meta.get("completion_tokens")
                or total_tokens
            )
            cost = float(usage_meta.get("cost") or 0.0)
        else:
            cost = 0.0

        log_usage_event(
            db,
            user=current_user,
            event_type="llm_stream",
            prompt_name=body.prompt_name,
            llm_model=model,
            tokens_used=total_tokens,
            cost_usd=cost,
        )

        done = {
            "type": "done",
            "model": model,
            "prompt_name": body.prompt_name,
            "tokens_used": total_tokens,
        }
        yield f"data: {json.dumps(done)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
