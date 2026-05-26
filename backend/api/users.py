import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.entitlements import has_ai_submit_review
from llm.usage_stats import get_user_usage
from schemas.usage import UsageOut
from core.learning_path import (
    EXPERIENCE_MESSAGES,
    ensure_personalized_path,
    personalized_path_response,
    regenerate_personalized_path,
)
from core.dashboard_insights import record_last_practice
from core.streak import maybe_backfill_streak
from db.session import get_db
from models.users import User
from schemas.user import LearningPathOut, LearningPathProblem, UserOut, UserUpdate


class SkillsOut(BaseModel):
    skill_level: dict[str, float]
    xp_total: int
    streak_days: int


class PracticeSessionBody(BaseModel):
    problem_id: uuid.UUID
    path_id: uuid.UUID | None = None


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    maybe_backfill_streak(current_user, db)
    db.refresh(current_user)
    base = UserOut.model_validate(current_user)
    return base.model_copy(
        update={"ai_submit_review": has_ai_submit_review(current_user, db)}
    )


@router.get("/me/usage", response_model=UsageOut)
def get_my_usage(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UsageOut:
    return get_user_usage(db, current_user)


@router.get("/me/skills", response_model=SkillsOut)
def get_my_skills(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SkillsOut:
    streak = maybe_backfill_streak(current_user, db)
    return SkillsOut(
        skill_level=current_user.skill_level or {},
        xp_total=current_user.xp_total or 0,
        streak_days=streak,
    )


@router.get("/me/learning-path", response_model=LearningPathOut)
def get_learning_path(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LearningPathOut:
    """Deprecated for new frontend; delegates to persisted personalized path."""
    experience = current_user.coding_experience or "none"
    selected, next_problems, library_total, difficulties = personalized_path_response(
        db, current_user
    )

    return LearningPathOut(
        problems=[LearningPathProblem.model_validate(p) for p in selected],
        message=EXPERIENCE_MESSAGES.get(experience, "Your personalized learning path."),
        next_problems=[LearningPathProblem.model_validate(p) for p in next_problems],
        library_total=library_total,
        difficulties=difficulties,
    )


@router.post("/me/practice-session", status_code=status.HTTP_204_NO_CONTENT)
def record_practice_session(
    body: PracticeSessionBody,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Track last opened problem for dashboard resume."""
    record_last_practice(
        db,
        current_user,
        problem_id=body.problem_id,
        path_id=body.path_id,
    )


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    regen_fields = {"coding_experience", "learning_goal", "interested_topics"}
    should_regen = bool(regen_fields & update_data.keys())

    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)

    if should_regen and user.coding_experience is not None:
        regenerate_personalized_path(db, user)
    elif user.coding_experience is not None:
        ensure_personalized_path(db, user)

    return user
