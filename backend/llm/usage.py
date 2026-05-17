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
) -> UsageEvent:
    event = UsageEvent(
        user_id=user.id,
        org_id=user.org_id,
        event_type=event_type,
        llm_model=llm_model,
        tokens_used=tokens_used,
        prompt_name=prompt_name,
        cost_usd=cost_usd,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
