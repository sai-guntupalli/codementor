from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.deps import get_current_user
from core.subscriptions import (
    list_active_plans,
    switch_user_plan,
    user_plan_snapshot,
)
from db.session import get_db
from models.users import User
from schemas.plan import DevPlanSwitchIn, PlanOut, UserPlanOut

router = APIRouter(tags=["plans"])


def _dev_switch_allowed() -> bool:
    return settings.debug or settings.dev_plan_switch


@router.get("/plans", response_model=list[PlanOut])
def list_plans(
    db: Annotated[Session, Depends(get_db)],
) -> list[PlanOut]:
    return list_active_plans(db)


@router.get("/users/me/plan", response_model=UserPlanOut)
def get_my_plan(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserPlanOut:
    snapshot = user_plan_snapshot(
        current_user, db, dev_switch_enabled=_dev_switch_allowed()
    )
    return UserPlanOut(
        plan=PlanOut.model_validate(snapshot["plan"]) if snapshot["plan"] else None,
        subscription_status=snapshot["subscription_status"],
        ai_submit_review=snapshot["ai_submit_review"],
        dev_switch_enabled=snapshot["dev_switch_enabled"],
    )


@router.put("/users/me/plan", response_model=UserPlanOut)
def switch_my_plan(
    body: DevPlanSwitchIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserPlanOut:
    if not _dev_switch_allowed():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Plan switching is disabled. Payment checkout will be available soon.",
        )

    user = db.query(User).filter(User.id == current_user.id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    switch_user_plan(db, user, body.plan_id)
    db.refresh(user)

    snapshot = user_plan_snapshot(user, db, dev_switch_enabled=True)
    return UserPlanOut(
        plan=PlanOut.model_validate(snapshot["plan"]) if snapshot["plan"] else None,
        subscription_status=snapshot["subscription_status"],
        ai_submit_review=snapshot["ai_submit_review"],
        dev_switch_enabled=True,
    )
