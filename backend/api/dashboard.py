"""Consolidated dashboard data endpoint."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.learning_path import EXPERIENCE_MESSAGES, build_learning_path, fetch_ranked_candidates
from core.problem_titles import strip_curriculum_prefix
from core.streak import recompute_streak
from db.session import get_db
from models.learning import Problem, Submission
from models.users import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class LearningPathProblem(BaseModel):
    id: uuid.UUID
    title: str
    difficulty: str
    topic: list[str]
    language: str

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return strip_curriculum_prefix(value) if isinstance(value, str) else value

    model_config = {"from_attributes": True}


class DashboardOut(BaseModel):
    # user summary
    display_name: str | None
    xp_total: int
    streak_days: int
    skill_level: dict
    solved_count: int
    # learning path
    learning_path: list[LearningPathProblem]
    learning_path_message: str
    # recent submissions (lightweight)
    recent_submissions: list[dict]
    # library total
    library_total: int


@router.get("/me", response_model=DashboardOut)
def get_dashboard(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DashboardOut:
    streak = recompute_streak(current_user, db)

    solved_count = (
        db.query(sqlfunc.count(Submission.problem_id.distinct()))
        .filter(Submission.user_id == current_user.id)
        .scalar()
    ) or 0

    recent_rows = (
        db.query(Submission, Problem.title)
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(Submission.user_id == current_user.id)
        .order_by(Submission.created_at.desc())
        .limit(5)
        .all()
    )
    recent_submissions = [
        {
            "id": str(s.id),
            "problem_id": str(s.problem_id),
            "problem_title": strip_curriculum_prefix(title),
            "language": s.language,
            "score": s.score,
            "hints_used": s.hints_used,
            "created_at": s.created_at.isoformat(),
        }
        for s, title in recent_rows
    ]

    candidates = fetch_ranked_candidates(db, current_user)
    selected, _ = build_learning_path(candidates)

    experience = getattr(current_user, "coding_experience", None) or "none"
    message = EXPERIENCE_MESSAGES.get(experience, "Your personalized learning path.")

    return DashboardOut(
        display_name=current_user.display_name,
        xp_total=current_user.xp_total or 0,
        streak_days=streak,
        skill_level=current_user.skill_level or {},
        solved_count=solved_count,
        learning_path=[LearningPathProblem.model_validate(p) for p in selected[:5]],
        learning_path_message=message,
        recent_submissions=recent_submissions,
        library_total=len(candidates),
    )
