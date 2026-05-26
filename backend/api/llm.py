"""LLM streaming endpoints (OpenRouter SSE passthrough)."""

import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from llm.quota import QuotaStatus, require_quota
from llm.registry import load_and_render, prompt_max_tokens
from llm.router import resolve_model
from llm.streaming import log_stream_usage, sse_response, stream_llm_to_sse
from models.users import User
from schemas.llm import LLMStreamRequest

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/stream")
async def stream_llm(
    body: LLMStreamRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quota_status: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """
    LLM-01/03: Render a DB prompt and stream the OpenRouter response as SSE.
    Events: data: {"token": "..."} then data: {"type": "done", ...}
    """
    rendered = load_and_render(db, body.prompt_name, body.variables)
    model = resolve_model(db, current_user, body.model)
    max_tokens = prompt_max_tokens(db, body.prompt_name)
    messages = [{"role": "user", "content": rendered}]

    async def event_generator() -> AsyncIterator[str]:
        total_tokens = 0
        cost = 0.0
        input_tokens = 0
        output_tokens = 0

        async for line in stream_llm_to_sse(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            quota_status=quota_status,
            on_complete=lambda _text, _usage: {"prompt_name": body.prompt_name},
        ):
            if line.startswith("data: "):
                payload = json.loads(line[6:].strip())
                if payload.get("type") == "done":
                    total_tokens = int(payload.get("tokens_used", 0))
                    cost = float(payload.get("cost_usd", 0.0))
                    input_tokens = int(payload.get("input_tokens", 0))
                    output_tokens = int(payload.get("output_tokens", 0))
            yield line

        log_stream_usage(
            db,
            user=current_user,
            event_type="llm_stream",
            prompt_name=body.prompt_name,
            model=model,
            tokens_used=total_tokens,
            cost_usd=cost,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    return sse_response(event_generator())
