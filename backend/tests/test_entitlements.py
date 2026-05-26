"""Tests for plan-based submit entitlements."""

import uuid

from core.entitlements import has_ai_submit_review
from models.billing import Plan, Subscription
from models.users import User


def test_free_user_without_subscription_has_no_ai_submit_review(db):
    user = User(
        id=uuid.uuid4(),
        email=f"free-{uuid.uuid4()}@example.com",
        profile_level="student",
        skill_level={},
    )
    db.add(user)
    db.commit()
    assert has_ai_submit_review(user, db) is False


def test_user_with_active_pro_subscription_has_ai_submit_review(db):
    pro = db.query(Plan).filter(Plan.name == "Pro").first()
    assert pro is not None

    sub = Subscription(
        plan_id=pro.id,
        entity_type="user",
        entity_id=uuid.uuid4(),
        status="active",
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    user = User(
        id=uuid.uuid4(),
        email=f"pro-{uuid.uuid4()}@example.com",
        profile_level="student",
        skill_level={},
        subscription_id=sub.id,
    )
    db.add(user)
    sub.entity_id = user.id
    db.commit()

    assert has_ai_submit_review(user, db) is True
