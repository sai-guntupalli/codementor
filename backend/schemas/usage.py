from pydantic import BaseModel


class UsageOut(BaseModel):
    calls_used: int
    calls_limit: int
    cost_usd_month: float
    resets_at: str
    breakdown: dict[str, int]


class ModelUsageStats(BaseModel):
    calls: int
    cost_usd: float


class TopUserUsage(BaseModel):
    user_id: str
    calls: int
    cost_usd: float


class AdminUsageOut(BaseModel):
    total_calls: int
    total_cost_usd: float
    by_model: dict[str, ModelUsageStats]
    by_feature: dict[str, int]
    top_users: list[TopUserUsage]
