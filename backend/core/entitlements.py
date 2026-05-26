"""Plan-based feature gates."""

from sqlalchemy.orm import Session

from models.billing import Plan, Subscription
from models.users import User


def has_ai_submit_review(user: User, db: Session) -> bool:
    """
    True when the user has an active paid subscription (e.g. Pro).
    Free-tier users (no subscription or Free plan) submit via test verification only.
    """
    if user.subscription_id is None:
        return False

    subscription = (
        db.query(Subscription).filter(Subscription.id == user.subscription_id).first()
    )
    if subscription is None or subscription.status != "active":
        return False

    plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
    if plan is None or not plan.is_active:
        return False

    return plan.name.strip().lower() != "free"
