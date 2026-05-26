from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.learning_paths import (
    _get_solved_ids,
    fetch_path_problems,
    list_paths_for_user,
)
from core.active_path import pick_active_learning_path
from core.deps import get_current_user
from core.streak import maybe_backfill_streak
from db.session import get_db
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

    active = pick_active_learning_path(paths)
    active_problems = (
        fetch_path_problems(db, active.id, solved_ids) if active else []
    )

    rows = (
        db.query(Submission, Problem.title)
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(Submission.user_id == current_user.id)
        .order_by(Submission.created_at.desc())
        .limit(5)
        .all()
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
        for sub, title in rows
    ]

    library_total = (
        db.query(Problem).filter(Problem.is_published.is_(True)).count()
    )

    return DashboardOut(
        user=UserOut.model_validate(current_user),
        recent_submissions=recent,
        learning_paths=paths,
        active_path_id=active.id if active else None,
        active_path_problems=active_problems,
        solved_count=len(solved_ids),
        library_total=library_total,
    )
