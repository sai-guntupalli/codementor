import uuid
from datetime import datetime

from pydantic import BaseModel


class ProblemPublicOut(BaseModel):
    """Problem payload for learners — hints omitted (revealed via /hint only)."""

    id: uuid.UUID
    title: str
    slug: str | None
    description: str
    language: str
    difficulty: str
    topic: list[str]
    examples: list[dict]
    constraints: str | None
    external_id: int | None
    source_url: str | None
    source: str
    sort_order: int | None
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemOut(ProblemPublicOut):
    """Full problem record including stored hints (admin/seeds)."""

    hints: list[str] | None = None


class ProblemListOut(BaseModel):
    items: list[ProblemPublicOut]
    total: int
    page: int
    page_size: int


class ProblemSolutionOut(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    language: str
    variant: str
    code: str
    time_complexity: str | None
    space_complexity: str | None
    explanation: str | None
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}
