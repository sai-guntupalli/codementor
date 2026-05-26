from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.learning_paths import (
    _get_solved_ids,
    fetch_path_problems,
    list_paths_for_user,
)
from core.active_path import resolve_active_learning_path
from core.dashboard_insights import (
    build_bookmarks,
    build_daily_challenge,
    build_daily_goal,
    build_last_session,
    build_path_completion,
    build_suggested_path,
    build_weak_topics,
    build_week_stats,
    count_paths_started,
)
from core.deps import get_current_user
from core.streak import maybe_backfill_streak
from db.session import get_db
from llm.usage_stats import get_user_usage
from models.learning import Problem, Submission
from models.users import User
from schemas.dashboard import DashboardOut
from schemas.submission import SubmissionHistoryItem
from schemas.user import UserOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/me", response_model=DashboardOut)
def get_dashboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DashboardOut:
    """Single round-trip payload for the home dashboard."""
    maybe_backfill_streak(current_user, db)
    db.refresh(current_user)

    solved_ids = _get_solved_ids(db, current_user.id)
    paths = list_paths_for_user(db, current_user)

    rows = (
        db.query(Submission, Problem.title)
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(Submission.user_id == current_user.id)
        .order_by(Submission.created_at.desc())
        .limit(10)
        .all()
    )
    recent_problem_ids = [sub.problem_id for sub, _ in rows]

    active = resolve_active_learning_path(
        db,
        paths,
        preferred_path_id=current_user.active_learning_path_id,
        recent_problem_ids=recent_problem_ids,
    )
    active_problems = (
        fetch_path_problems(db, active.id, solved_ids) if active else []
    )
    recent = [
        SubmissionHistoryItem(
            id=sub.id,
            problem_id=sub.problem_id,
            problem_title=title,
            language=sub.language,
            score=sub.score,
            hints_used=sub.hints_used,
            solution_viewed=sub.solution_viewed,
            created_at=sub.created_at,
        )
        for sub, title in rows[:5]
    ]

    library_total = (
        db.query(Problem).filter(Problem.is_published.is_(True)).count()
    )

    daily_goal = build_daily_goal(db, current_user.id)
    paths_started = count_paths_started(paths)

    return DashboardOut(
        user=UserOut.model_validate(current_user),
        recent_submissions=recent,
        learning_paths=paths,
        active_path_id=active.id if active else None,
        active_path_problems=active_problems,
        solved_count=len(solved_ids),
        library_total=library_total,
        usage=get_user_usage(db, current_user),
        daily_challenge=build_daily_challenge(
            db,
            current_user,
            active_path_id=active.id if active else None,
            active_problems=active_problems,
            solved_ids=solved_ids,
        ),
        daily_goal=daily_goal,
        weak_topics=build_weak_topics(db, current_user, solved_ids=solved_ids),
        bookmarks=build_bookmarks(db, current_user.id),
        week_stats=build_week_stats(db, current_user),
        last_session=build_last_session(
            db,
            current_user,
            active_path_id=active.id if active else None,
        ),
        path_completion=build_path_completion(
            active,
            solved_today=daily_goal.solved_today,
        ),
        suggested_path=build_suggested_path(
            paths,
            has_focus=active is not None and active.progress.progress_pct > 0,
            paths_started_count=paths_started,
        ),
        paths_started_count=paths_started,
        has_any_submission=len(rows) > 0,
    )
