"""Daily practice streak from submission activity dates."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.learning import Submission
from models.users import User


def _distinct_activity_days(user_id: uuid.UUID, db: Session) -> list[date]:
    rows = (
        db.query(func.date(Submission.created_at))
        .filter(Submission.user_id == user_id)
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows if r[0] is not None}, reverse=True)


def compute_streak_days(user_id: uuid.UUID, db: Session) -> int:
    """Consecutive calendar days with submissions, ending on the most recent activity day.

    The streak stays active if the user practiced today or yesterday; otherwise it is 0.
    """
    days = _distinct_activity_days(user_id, db)
    if not days:
        return 0

    anchor = days[0]
    today = date.today()
    if anchor < today - timedelta(days=1):
        return 0

    streak = 1
    expected = anchor - timedelta(days=1)
    for day in days[1:]:
        if day == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif day < expected:
            break
    return streak


def recompute_streak(user: User, db: Session) -> int:
    streak = compute_streak_days(user.id, db)
    user.streak_days = streak
    db.add(user)
    return streak


def maybe_backfill_streak(user: User, db: Session) -> int:
    """Recompute when streak is unset but the user has submission history."""
    if (user.streak_days or 0) > 0:
        return user.streak_days
    has_activity = (
        db.query(Submission.id).filter(Submission.user_id == user.id).limit(1).first()
        is not None
    )
    if not has_activity:
        return 0
    streak = recompute_streak(user, db)
    db.commit()
    db.refresh(user)
    return streak
