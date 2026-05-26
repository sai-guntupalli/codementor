"""User subscription helpers (dev plan switch; Stripe integration later)."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.entitlements import has_ai_submit_review
from models.billing import Plan, Subscription
from models.users import User


def list_active_plans(db: Session) -> list[Plan]:
    return (
        db.query(Plan)
        .filter(Plan.is_active.is_(True))
        .order_by(Plan.price_monthly.asc())
        .all()
    )


def get_user_plan(user: User, db: Session) -> Plan | None:
    if user.subscription_id is None:
        return db.query(Plan).filter(Plan.name.ilike("free")).first()

    subscription = (
        db.query(Subscription).filter(Subscription.id == user.subscription_id).first()
    )
    if subscription is None:
        return db.query(Plan).filter(Plan.name.ilike("free")).first()

    return db.query(Plan).filter(Plan.id == subscription.plan_id).first()


def get_user_subscription(user: User, db: Session) -> Subscription | None:
    if user.subscription_id is None:
        return None
    return db.query(Subscription).filter(Subscription.id == user.subscription_id).first()


def assign_user_plan(db: Session, user: User, plan: Plan) -> Subscription:
    """Attach user to plan via an active subscription (no Stripe)."""
    now = datetime.now(timezone.utc)
    subscription = get_user_subscription(user, db)

    if subscription is None:
        subscription = Subscription(
            plan_id=plan.id,
            entity_type="user",
            entity_id=user.id,
            status="active",
            current_period_start=now,
        )
        db.add(subscription)
        db.flush()
        user.subscription_id = subscription.id
    else:
        subscription.plan_id = plan.id
        subscription.status = "active"
        subscription.entity_type = "user"
        subscription.entity_id = user.id
        if subscription.current_period_start is None:
            subscription.current_period_start = now

    db.commit()
    db.refresh(user)
    db.refresh(subscription)
    return subscription


def switch_user_plan(db: Session, user: User, plan_id: uuid.UUID) -> tuple[Plan, Subscription]:
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.is_active.is_(True)).first()
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    subscription = assign_user_plan(db, user, plan)
    return plan, subscription


def user_plan_snapshot(user: User, db: Session, *, dev_switch_enabled: bool) -> dict:
    plan = get_user_plan(user, db)
    subscription = get_user_subscription(user, db)
    return {
        "plan": plan,
        "subscription_status": subscription.status if subscription else None,
        "ai_submit_review": has_ai_submit_review(user, db),
        "dev_switch_enabled": dev_switch_enabled,
    }
