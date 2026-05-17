from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.users import User
from schemas.user import UserOut, UserUpdate


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


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
