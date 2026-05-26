"""Unit tests for monthly LLM quota enforcement."""

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from llm.quota import QuotaStatus, compute_quota_status, require_quota
from models.billing import Plan, UsageEvent
from models.users import User


@pytest.fixture
def free_plan(db):
    plan = db.query(Plan).filter(Plan.name == "Free").first()
    if plan is None:
        plan = Plan(
            name="Free",
            llm_calls_per_month=50,
            allowed_models=["test/model"],
            is_active=True,
        )
        db.add(plan)
        db.commit()
    plan.llm_calls_per_month = 50
    db.commit()
    return plan


def _add_usage_events(db, user_id: uuid.UUID, count: int) -> None:
    for _ in range(count):
        db.add(
            UsageEvent(
                user_id=user_id,
                event_type="test",
                prompt_name="test",
                llm_model="test/model",
                tokens_used=10,
                cost_usd=0.01,
                created_at=datetime.now(timezone.utc),
            )
        )
    db.commit()


@pytest.mark.asyncio
async def test_quota_allows_under_limit(db, persisted_user, free_plan):
    _add_usage_events(db, persisted_user.id, 10)
    status = compute_quota_status(persisted_user, db)
    assert status.calls_used == 10
    assert status.calls_limit == 50
    assert status.pct_used == pytest.approx(0.2)


@pytest.mark.asyncio
async def test_quota_blocks_at_limit(db, persisted_user, free_plan):
    _add_usage_events(db, persisted_user.id, 50)

    with patch("llm.quota.check_rate_limit"):
        with pytest.raises(HTTPException) as exc:
            await require_quota(current_user=persisted_user, db=db)
    assert exc.value.status_code == 429
    detail = exc.value.detail
    assert detail["calls_used"] == 50
    assert detail["calls_limit"] == 50


@pytest.mark.asyncio
async def test_quota_blocks_over_limit(db, persisted_user, free_plan):
    _add_usage_events(db, persisted_user.id, 51)

    with patch("llm.quota.check_rate_limit"):
        with pytest.raises(HTTPException) as exc:
            await require_quota(current_user=persisted_user, db=db)
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_quota_returns_status_below_limit(db, persisted_user, free_plan):
    _add_usage_events(db, persisted_user.id, 40)

    with patch("llm.quota.check_rate_limit"):
        status = await require_quota(current_user=persisted_user, db=db)
    assert isinstance(status, QuotaStatus)
    assert status.calls_used == 40
