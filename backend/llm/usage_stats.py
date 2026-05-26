"""Aggregate usage_events for user and admin dashboards."""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from llm.quota import _period_start, compute_quota_status
from models.billing import UsageEvent
from models.users import User
from schemas.usage import AdminUsageOut, ModelUsageStats, TopUserUsage, UsageOut


def _format_resets_at(dt: datetime) -> str:
    iso = dt.isoformat()
    if iso.endswith("+00:00"):
        return iso.replace("+00:00", "Z")
    return iso + "Z"


def get_user_usage(db: Session, user: User) -> UsageOut:
    status = compute_quota_status(user, db)
    period_start = _period_start()

    cost_row = (
        db.query(func.coalesce(func.sum(UsageEvent.cost_usd), 0.0))
        .filter(
            UsageEvent.user_id == user.id,
            UsageEvent.created_at >= period_start,
        )
        .scalar()
    )
    cost_usd_month = float(cost_row or 0.0)

    breakdown_rows = (
        db.query(UsageEvent.prompt_name, func.count(UsageEvent.id))
        .filter(
            UsageEvent.user_id == user.id,
            UsageEvent.created_at >= period_start,
            UsageEvent.prompt_name.isnot(None),
        )
        .group_by(UsageEvent.prompt_name)
        .all()
    )
    breakdown = {name: count for name, count in breakdown_rows if name}

    return UsageOut(
        calls_used=status.calls_used,
        calls_limit=status.calls_limit,
        cost_usd_month=round(cost_usd_month, 4),
        resets_at=_format_resets_at(status.resets_at),
        breakdown=breakdown,
    )


def get_admin_usage(
    db: Session,
    *,
    from_date: datetime,
    to_date: datetime,
) -> AdminUsageOut:
    base = db.query(UsageEvent).filter(
        UsageEvent.created_at >= from_date,
        UsageEvent.created_at < to_date,
    )

    total_calls = base.count()
    total_cost_row = (
        db.query(func.coalesce(func.sum(UsageEvent.cost_usd), 0.0))
        .filter(
            UsageEvent.created_at >= from_date,
            UsageEvent.created_at < to_date,
        )
        .scalar()
    )
    total_cost_usd = float(total_cost_row or 0.0)

    by_model_rows = (
        db.query(
            UsageEvent.llm_model,
            func.count(UsageEvent.id),
            func.coalesce(func.sum(UsageEvent.cost_usd), 0.0),
        )
        .filter(
            UsageEvent.created_at >= from_date,
            UsageEvent.created_at < to_date,
            UsageEvent.llm_model.isnot(None),
        )
        .group_by(UsageEvent.llm_model)
        .all()
    )
    by_model = {
        model: ModelUsageStats(calls=calls, cost_usd=round(float(cost), 4))
        for model, calls, cost in by_model_rows
        if model
    }

    by_feature_rows = (
        db.query(UsageEvent.prompt_name, func.count(UsageEvent.id))
        .filter(
            UsageEvent.created_at >= from_date,
            UsageEvent.created_at < to_date,
            UsageEvent.prompt_name.isnot(None),
        )
        .group_by(UsageEvent.prompt_name)
        .all()
    )
    by_feature = {name: count for name, count in by_feature_rows if name}

    top_user_rows = (
        db.query(
            UsageEvent.user_id,
            func.count(UsageEvent.id),
            func.coalesce(func.sum(UsageEvent.cost_usd), 0.0),
        )
        .filter(
            UsageEvent.created_at >= from_date,
            UsageEvent.created_at < to_date,
            UsageEvent.user_id.isnot(None),
        )
        .group_by(UsageEvent.user_id)
        .order_by(func.count(UsageEvent.id).desc())
        .limit(10)
        .all()
    )
    top_users = [
        TopUserUsage(
            user_id=str(user_id),
            calls=calls,
            cost_usd=round(float(cost), 4),
        )
        for user_id, calls, cost in top_user_rows
        if user_id
    ]

    return AdminUsageOut(
        total_calls=total_calls,
        total_cost_usd=round(total_cost_usd, 4),
        by_model=by_model,
        by_feature=by_feature,
        top_users=top_users,
    )
