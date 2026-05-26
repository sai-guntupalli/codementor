"""Dev plan switching (no Stripe)."""

import uuid

import pytest
from fastapi.testclient import TestClient

from core.config import settings
from models.billing import Plan
from models.users import User


@pytest.fixture
def dev_switch_on(monkeypatch):
    monkeypatch.setattr(settings, "debug", True)
    monkeypatch.setattr(settings, "dev_plan_switch", False)


def test_list_plans_returns_seeded_plans(client: TestClient, db):
    response = client.get("/plans")
    assert response.status_code == 200
    names = {p["name"] for p in response.json()}
    assert "Free" in names
    assert "Pro" in names


def test_get_my_plan_without_subscription_defaults_to_free(
    auth_client: TestClient, persisted_user: User, db
):
    response = auth_client.get("/users/me/plan")
    assert response.status_code == 200
    body = response.json()
    assert body["plan"]["name"] == "Free"
    assert body["ai_submit_review"] is False


def test_switch_to_pro_enables_ai_submit_review(
    auth_client: TestClient, persisted_user: User, db, dev_switch_on
):
    pro = db.query(Plan).filter(Plan.name == "Pro").first()
    assert pro is not None

    response = auth_client.put("/users/me/plan", json={"plan_id": str(pro.id)})
    assert response.status_code == 200
    body = response.json()
    assert body["plan"]["name"] == "Pro"
    assert body["ai_submit_review"] is True
    assert body["subscription_status"] == "active"

    db.refresh(persisted_user)
    assert persisted_user.subscription_id is not None


def test_switch_plan_disabled_when_not_dev(auth_client: TestClient, db, monkeypatch):
    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "dev_plan_switch", False)

    pro = db.query(Plan).filter(Plan.name == "Pro").first()
    response = auth_client.put("/users/me/plan", json={"plan_id": str(pro.id)})
    assert response.status_code == 403


def test_switch_unknown_plan_returns_404(auth_client: TestClient, dev_switch_on):
    response = auth_client.put(
        "/users/me/plan", json={"plan_id": str(uuid.uuid4())}
    )
    assert response.status_code == 404
