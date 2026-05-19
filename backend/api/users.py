from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.learning import Problem
from models.users import User
from schemas.user import LearningPathOut, LearningPathProblem, UserOut, UserUpdate

_EXPERIENCE_TO_DIFFICULTIES: dict[str, list[str]] = {
    "none": ["beginner"],
    "some": ["beginner", "easy"],
    "comfortable": ["easy", "medium"],
    "professional": ["medium", "hard"],
}

_GOAL_TOPIC_BOOST: dict[str, list[str]] = {
    "job": ["arrays", "hash-map", "binary-tree", "graph", "dynamic-programming", "recursion"],
    "improve": ["dynamic-programming", "graph", "recursion", "sorting", "binary-search"],
    "fun": ["strings", "math", "puzzles", "loops"],
    "course": ["strings", "arrays", "loops", "functions", "math"],
}


class SkillsOut(BaseModel):
    skill_level: dict[str, float]
    xp_total: int
    streak_days: int


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserOut:
    return current_user


@router.get("/me/skills", response_model=SkillsOut)
def get_my_skills(
    current_user: Annotated[User, Depends(get_current_user)],
) -> SkillsOut:
    return SkillsOut(
        skill_level=current_user.skill_level or {},
        xp_total=current_user.xp_total or 0,
        streak_days=current_user.streak_days or 0,
    )


@router.get("/me/learning-path", response_model=LearningPathOut)
def get_learning_path(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LearningPathOut:
    experience = current_user.coding_experience or "none"
    goal = current_user.learning_goal or "fun"
    interested = set(current_user.interested_topics or [])

    difficulties = _EXPERIENCE_TO_DIFFICULTIES.get(experience, ["beginner"])
    boosted_topics = _GOAL_TOPIC_BOOST.get(goal, [])

    query = (
        db.query(Problem)
        .filter(Problem.is_published.is_(True), Problem.difficulty.in_(difficulties))
        .order_by(Problem.sort_order.asc().nulls_last())
    )
    candidates = query.limit(200).all()

    def score(p: Problem) -> int:
        s = 0
        p_topics = set(p.topic or [])
        if p_topics & interested:
            s += 3
        if p_topics & set(boosted_topics):
            s += 2
        return s

    candidates.sort(key=score, reverse=True)
    selected = candidates[:12]

    messages = {
        "none": "Here's your beginner-friendly path — no prior experience needed.",
        "some": "Problems selected to build on what you already know.",
        "comfortable": "A mix of easy and medium problems to sharpen your skills.",
        "professional": "Challenging problems to level up your interview readiness.",
    }

    return LearningPathOut(
        problems=[LearningPathProblem.model_validate(p) for p in selected],
        message=messages.get(experience, "Your personalized learning path."),
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
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
