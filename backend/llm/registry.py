"""Load prompt templates from DB and render with runtime variables."""

from string import Formatter
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.content import Prompt


class SafeFormatter(Formatter):
    """Leave unknown placeholders unchanged instead of raising KeyError."""

    def get_value(self, key: str, args: tuple, kwargs: dict) -> Any:
        if isinstance(key, str) and key not in kwargs:
            return "{" + key + "}"
        return super().get_value(key, args, kwargs)


def load_active_prompt(db: Session, name: str) -> Prompt:
    prompt = (
        db.query(Prompt)
        .filter(Prompt.name == name, Prompt.is_active.is_(True))
        .order_by(Prompt.version.desc())
        .first()
    )
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt '{name}' not found",
        )
    return prompt


def render_prompt(template: str, variables: dict[str, str]) -> str:
    """Render {placeholders} in template; missing keys are left as-is."""
    return SafeFormatter().format(template, **variables)


def load_and_render(db: Session, name: str, variables: dict[str, str]) -> str:
    prompt = load_active_prompt(db, name)
    return render_prompt(prompt.template, variables)


def prompt_max_tokens(db: Session, name: str) -> int | None:
    """Return max_tokens for the active prompt, or None for OpenRouter default."""
    return load_active_prompt(db, name).max_tokens
