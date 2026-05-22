import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from core.problem_titles import strip_curriculum_prefix


class LearningPathProgress(BaseModel):
    solved_count: int
    total_count: int
    progress_pct: int


class LearningPathOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    type: str
    created_by: uuid.UUID | None
    is_public: bool
    sort_order: int | None
    created_at: datetime
    progress: LearningPathProgress

    model_config = {"from_attributes": True}


class LearningPathCreate(BaseModel):
    title: str
    description: str | None = None


class LearningPathUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class LearningPathProblemItem(BaseModel):
    id: uuid.UUID
    title: str

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return strip_curriculum_prefix(value) if isinstance(value, str) else value
    slug: str | None
    difficulty: str
    topic: list[str]
    language: str
    solved: bool

    model_config = {"from_attributes": True}


class AddProblemBody(BaseModel):
    problem_id: uuid.UUID
