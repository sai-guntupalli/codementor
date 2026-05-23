import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from core.streak import compute_streak_days, recompute_streak
from models.learning import Problem, Submission
from models.users import User


def _submission(db: Session, user_id: uuid.UUID, problem_id: uuid.UUID, day: date) -> None:
    at = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
    db.add(
        Submission(
            user_id=user_id,
            problem_id=problem_id,
            code="print(1)",
            language="python",
            created_at=at,
        )
    )


def test_streak_zero_without_submissions(db: Session, persisted_user: User):
    assert compute_streak_days(persisted_user.id, db) == 0


def test_streak_one_for_single_day(db: Session, persisted_user: User):
    problem = Problem(
        title="P",
        description="d" * 20,
        difficulty="easy",
        language="python",
        source="curated",
    )
    db.add(problem)
    db.flush()
    _submission(db, persisted_user.id, problem.id, date.today())
    db.commit()
    assert compute_streak_days(persisted_user.id, db) == 1


def test_streak_counts_consecutive_days(db: Session, persisted_user: User):
    problem = Problem(
        title="P2",
        description="d" * 20,
        difficulty="easy",
        language="python",
        source="curated",
    )
    db.add(problem)
    db.flush()
    today = date.today()
    _submission(db, persisted_user.id, problem.id, today)
    _submission(db, persisted_user.id, problem.id, today - timedelta(days=1))
    _submission(db, persisted_user.id, problem.id, today - timedelta(days=2))
    db.commit()
    assert compute_streak_days(persisted_user.id, db) == 3


def test_streak_broken_after_gap(db: Session, persisted_user: User):
    problem = Problem(
        title="P3",
        description="d" * 20,
        difficulty="easy",
        language="python",
        source="curated",
    )
    db.add(problem)
    db.flush()
    _submission(db, persisted_user.id, problem.id, date.today() - timedelta(days=3))
    db.commit()
    assert compute_streak_days(persisted_user.id, db) == 0


def test_recompute_streak_updates_user(db: Session, persisted_user: User):
    problem = Problem(
        title="P4",
        description="d" * 20,
        difficulty="easy",
        language="python",
        source="curated",
    )
    db.add(problem)
    db.flush()
    _submission(db, persisted_user.id, problem.id, date.today())
    db.commit()
    recompute_streak(persisted_user, db)
    db.commit()
    db.refresh(persisted_user)
    assert persisted_user.streak_days == 1
