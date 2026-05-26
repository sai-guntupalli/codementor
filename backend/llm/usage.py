"""Log LLM calls to usage_events."""

import uuid

from sqlalchemy.orm import Session

from models.billing import UsageEvent
from models.users import User


def log_usage_event(
    db: Session,
    *,
    user: User,
    event_type: str,
    prompt_name: str,
    llm_model: str,
    tokens_used: int,
    cost_usd: float = 0.0,
    input_tokens: int = 0,
    output_tokens: int = 0,
    problem_id: uuid.UUID | None = None,
) -> UsageEvent:
    event = UsageEvent(
        user_id=user.id,
        org_id=user.org_id,
        event_type=event_type,
        llm_model=llm_model,
        tokens_used=tokens_used,
        prompt_name=prompt_name,
        cost_usd=cost_usd,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        problem_id=problem_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
