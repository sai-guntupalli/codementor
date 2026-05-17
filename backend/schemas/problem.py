import uuid
from datetime import datetime

from pydantic import BaseModel


class ProblemOut(BaseModel):
    id: uuid.UUID
    title: str
    slug: str | None
    description: str
    language: str
    difficulty: str
    topic: list[str]
    examples: list[dict]
    constraints: str | None
    hints: list[str] | None
    external_id: int | None
    source_url: str | None
    source: str
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemListOut(BaseModel):
    items: list[ProblemOut]
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
