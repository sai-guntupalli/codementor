"""Integration tests for usage reporting endpoints."""

import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from models.billing import UsageEvent
from models.users import User


def test_get_my_usage(auth_client: TestClient, persisted_user, db):
    db.add(
        UsageEvent(
            user_id=persisted_user.id,
            event_type="code_review",
            prompt_name="code_review",
            llm_model="test/model",
            tokens_used=100,
            cost_usd=0.05,
            created_at=datetime.now(timezone.utc),
        )
    )
    db.add(
        UsageEvent(
            user_id=persisted_user.id,
            event_type="hint",
            prompt_name="hints_lazy",
            llm_model="test/model",
            tokens_used=50,
            cost_usd=0.02,
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    response = auth_client.get("/users/me/usage")
    assert response.status_code == 200
    body = response.json()
    assert body["calls_used"] == 2
    assert body["calls_limit"] >= 1
    assert body["cost_usd_month"] == pytest.approx(0.07, rel=1e-3)
    assert body["breakdown"]["code_review"] == 1
    assert body["breakdown"]["hints_lazy"] == 1
    assert "resets_at" in body


def test_admin_usage_forbidden_for_non_admin(auth_client: TestClient):
    response = auth_client.get("/admin/usage")
    assert response.status_code == 403


def test_admin_usage_for_admin(auth_client: TestClient, persisted_user, db):
    persisted_user.is_admin = True
    db.commit()

    response = auth_client.get("/admin/usage")
    assert response.status_code == 200
    body = response.json()
    assert "total_calls" in body
    assert "total_cost_usd" in body
    assert "by_model" in body
    assert "by_feature" in body
    assert "top_users" in body


import pytest  # noqa: E402
