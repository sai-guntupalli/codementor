"""Tests for dashboard insight builders."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from core.dashboard_insights import (
    build_daily_challenge,
    build_daily_goal,
    build_suggested_path,
    build_week_stats,
)
from models.learning import Submission
from models.users import User
from schemas.learning_path import LearningPathOut, LearningPathProgress, LearningPathProblemItem
from tests.test_learning_paths import _add_problem_to_path, _make_curated_path, _make_problem


def _path_out(path_id: uuid.UUID, title: str, **progress_kw) -> LearningPathOut:
    total = progress_kw.get("total_count", 5)
    solved = progress_kw.get("solved_count", 0)
    pct = round(solved / total * 100) if total else 0
    return LearningPathOut(
        id=path_id,
        title=title,
        description=None,
        type="curated",
        created_by=None,
        is_public=True,
        sort_order=1,
        created_at=datetime.now(UTC),
        progress=LearningPathProgress(
            solved_count=solved, total_count=total, progress_pct=pct
        ),
    )


def test_daily_goal_counts_today_submissions(db: Session, persisted_user: User):
    problem = _make_problem(db)
    sub = Submission(
        user_id=persisted_user.id,
        problem_id=problem.id,
        code="print(1)",
        language="python",
        score=1.0,
        created_at=datetime.now(UTC),
    )
    db.add(sub)
    db.commit()

    goal = build_daily_goal(db, persisted_user.id)
    assert goal.solved_today >= 1
    assert goal.met is True


def test_daily_challenge_picks_unsolved_from_active_path(db: Session, persisted_user: User):
    path = _make_curated_path(db, title="Arrays")
    p1 = _make_problem(db)
    p2 = _make_problem(db)
    _add_problem_to_path(db, path.id, p1.id)
    _add_problem_to_path(db, path.id, p2.id)
    problems = [
        LearningPathProblemItem(
            id=p1.id,
            title=p1.title,
            slug=p1.slug,
            difficulty=p1.difficulty,
            topic=p1.topic or [],
            language=p1.language,
            solved=False,
        ),
        LearningPathProblemItem(
            id=p2.id,
            title=p2.title,
            slug=p2.slug,
            difficulty=p2.difficulty,
            topic=p2.topic or [],
            language=p2.language,
            solved=False,
        ),
    ]
    challenge = build_daily_challenge(
        db,
        persisted_user,
        active_path_id=path.id,
        active_problems=problems,
        solved_ids=set(),
    )
    assert challenge is not None
    assert challenge.problem_id in {p1.id, p2.id}


def test_suggested_path_for_new_user(db: Session):
    basics_id = uuid.uuid4()
    paths = [
        _path_out(basics_id, "Python Basics", solved_count=0, total_count=10),
        _path_out(uuid.uuid4(), "Loops", solved_count=0, total_count=8),
    ]
    suggested = build_suggested_path(paths, has_focus=False, paths_started_count=0)
    assert suggested is not None
    assert suggested.title == "Python Basics"


def test_week_stats(db: Session, persisted_user: User):
    problem = _make_problem(db)
    now = datetime.now(UTC)
    db.add(
        Submission(
            user_id=persisted_user.id,
            problem_id=problem.id,
            code="x",
            language="python",
            score=0.8,
            created_at=now - timedelta(days=1),
        )
    )
    db.commit()
    stats = build_week_stats(db, persisted_user)
    assert stats.submissions_this_week >= 1
