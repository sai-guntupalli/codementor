"""Monthly quota enforcement as a FastAPI dependency."""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.deps import get_current_user, get_db
from llm import rate_limit
from models.billing import Plan, Subscription, UsageEvent
from models.users import User

_FREE_PLAN_FALLBACK_LIMIT = 50


@dataclass
class QuotaStatus:
    calls_used: int
    calls_limit: int
    pct_used: float
    resets_at: datetime


def _plan_name_to_tier(plan_name: str) -> str:
    """Map plan name to rate-limit tier. Unknown → 'free'."""
    name = plan_name.lower()
    if "pro" in name:
        return "pro"
    return "free"


def _period_start() -> datetime:
    """First day of the current UTC month at midnight (tz-aware)."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _resets_at() -> datetime:
    """First day of next UTC month at midnight (tz-aware)."""
    now = datetime.now(timezone.utc)
    if now.month == 12:
        return now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)


def _resolve_plan(user: User, db: Session) -> Plan | None:
    """Return the user's active Plan, or None if not found."""
    if user.subscription_id is not None:
        subscription = db.query(Subscription).filter(Subscription.id == user.subscription_id).first()
        if subscription and subscription.status == "active":
            plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
            if plan:
                return plan

    return db.query(Plan).filter(Plan.name.ilike("free")).first()


def check_rate_limit(user: User, plan_name: str) -> None:
    """Raise HTTP 429 with Retry-After header if per-minute rate is exceeded."""
    tier = _plan_name_to_tier(plan_name)
    rate_limit.check(user_id=str(user.id), tier=tier)


def compute_quota_status(user: User, db: Session) -> QuotaStatus:
    """Return current quota snapshot without enforcing limits."""
    plan = _resolve_plan(user, db)

    if plan is not None:
        calls_limit = plan.llm_calls_per_month
    else:
        calls_limit = _FREE_PLAN_FALLBACK_LIMIT

    period_start = _period_start()
    resets_at = _resets_at()

    calls_used = (
        db.query(UsageEvent)
        .filter(
            UsageEvent.user_id == user.id,
            UsageEvent.created_at >= period_start,
        )
        .count()
    )

    if calls_limit > 0:
        pct_used = calls_used / calls_limit
    else:
        pct_used = 0.0

    return QuotaStatus(
        calls_used=calls_used,
        calls_limit=calls_limit,
        pct_used=pct_used,
        resets_at=resets_at,
    )


async def require_quota(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuotaStatus:
    """FastAPI dependency. Raises HTTP 429 if monthly quota exceeded."""
    plan = _resolve_plan(current_user, db)
    plan_name = plan.name if plan is not None else "free"

    check_rate_limit(current_user, plan_name)

    quota = compute_quota_status(current_user, db)

    if quota.calls_used >= quota.calls_limit and quota.calls_limit > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Monthly AI call limit reached",
                "calls_used": quota.calls_used,
                "calls_limit": quota.calls_limit,
                "resets_at": quota.resets_at.isoformat().replace("+00:00", "Z"),
            },
        )

    return quota
