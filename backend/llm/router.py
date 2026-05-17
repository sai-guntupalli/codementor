"""Resolve which OpenRouter model a user may use."""

from functools import lru_cache
from pathlib import Path

import yaml
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.billing import Plan, Subscription
from models.content import UserSetting
from models.users import User

MODELS_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "models.yaml"


@lru_cache
def load_models_config() -> dict:
    with MODELS_CONFIG_PATH.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def default_model_id() -> str:
    return load_models_config().get("default_model", "anthropic/claude-sonnet-4-5")


def get_allowed_models(db: Session, user: User) -> list[str]:
    if user.subscription_id:
        sub = db.query(Subscription).filter(Subscription.id == user.subscription_id).first()
        if sub:
            plan = db.query(Plan).filter(Plan.id == sub.plan_id, Plan.is_active.is_(True)).first()
            if plan and plan.allowed_models:
                return list(plan.allowed_models)

    free_plan = db.query(Plan).filter(Plan.name == "Free", Plan.is_active.is_(True)).first()
    if free_plan and free_plan.allowed_models:
        return list(free_plan.allowed_models)

    return [default_model_id()]


def get_user_preferred_model(db: Session, user: User) -> str:
    row = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if row and row.llm_model:
        return row.llm_model
    return default_model_id()


def resolve_model(db: Session, user: User, requested_model: str | None = None) -> str:
    """
    Pick model: explicit request > user_settings.llm_model > default.
    Must be in plan.allowed_models.
    """
    allowed = get_allowed_models(db, user)
    candidate = requested_model or get_user_preferred_model(db, user)

    if candidate not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Model '{candidate}' is not available on your plan. Allowed: {', '.join(allowed)}",
        )
    return candidate
