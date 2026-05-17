"""Tests for Phase 4 LLM layer (registry, router)."""

import uuid

import pytest
from fastapi import HTTPException

from llm.registry import render_prompt
from llm.router import resolve_model
from models.billing import Plan
from models.content import Prompt, UserSetting
from models.users import User


def test_render_prompt_substitutes_variables():
    template = "Hello {name}, level {user_level}"
    out = render_prompt(template, {"name": "Sai", "user_level": "student"})
    assert out == "Hello Sai, level student"


def test_render_prompt_leaves_unknown_placeholders():
    template = "Code: {code}"
    out = render_prompt(template, {})
    assert out == "Code: {code}"


def test_resolve_model_uses_free_plan_allowed(db):
    free = db.query(Plan).filter(Plan.name == "Free").first()
    assert free is not None

    user = User(
        id=uuid.uuid4(),
        email=f"llm-{uuid.uuid4()}@example.com",
        profile_level="student",
        skill_level={},
    )
    db.add(user)
    db.commit()

    model = resolve_model(db, user)
    assert model in free.allowed_models


def test_resolve_model_rejects_disallowed(db):
    free = db.query(Plan).filter(Plan.name == "Free").first()
    assert free is not None
    pro_only = "openai/gpt-4o"
    if pro_only in (free.allowed_models or []):
        pytest.skip("Free plan includes gpt-4o in this DB seed")

    user = User(
        id=uuid.uuid4(),
        email=f"llm-{uuid.uuid4()}@example.com",
        profile_level="student",
        skill_level={},
    )
    db.add(user)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        resolve_model(db, user, requested_model=pro_only)
    assert exc.value.status_code == 403


def test_resolve_model_honors_user_settings(db):
    free = db.query(Plan).filter(Plan.name == "Free").first()
    allowed = list(free.allowed_models or [])
    if not allowed:
        pytest.skip("No allowed models on Free plan")

    user = User(
        id=uuid.uuid4(),
        email=f"llm-{uuid.uuid4()}@example.com",
        profile_level="student",
        skill_level={},
    )
    db.add(user)
    db.commit()

    preferred = allowed[0]
    db.add(UserSetting(user_id=user.id, llm_model=preferred))
    db.commit()

    assert resolve_model(db, user) == preferred


def test_load_active_prompt_from_db(db):
    from llm.registry import load_active_prompt

    prompt = load_active_prompt(db, "code_review")
    assert prompt.name == "code_review"
    assert "{code}" in prompt.template
