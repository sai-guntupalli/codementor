import uuid
from datetime import datetime

from pydantic import BaseModel


class ProblemOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    language: str
    difficulty: str
    topic: list[str]
    examples: dict
    constraints: str | None
    source: str
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemListOut(BaseModel):
    items: list[ProblemOut]
    total: int
    page: int
    page_size: int
