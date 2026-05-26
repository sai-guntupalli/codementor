import uuid

from pydantic import BaseModel


class PlanOut(BaseModel):
    id: uuid.UUID
    name: str
    price_monthly: float
    price_yearly: float
    llm_calls_per_month: int
    features: dict
    is_active: bool

    model_config = {"from_attributes": True}


class UserPlanOut(BaseModel):
    plan: PlanOut | None
    subscription_status: str | None
    ai_submit_review: bool
    dev_switch_enabled: bool


class DevPlanSwitchIn(BaseModel):
    plan_id: uuid.UUID
