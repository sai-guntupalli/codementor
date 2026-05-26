import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from core.problem_titles import strip_curriculum_prefix


class ProblemListItem(BaseModel):
    """Lightweight row for problem browse lists."""

    id: uuid.UUID
    title: str

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return strip_curriculum_prefix(value) if isinstance(value, str) else value
    slug: str | None
    language: str
    difficulty: str
    topic: list[str]
    source: str
    external_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemPublicOut(BaseModel):
    """Problem payload for learners — hints omitted (revealed via /hint only)."""

    id: uuid.UUID
    title: str

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return strip_curriculum_prefix(value) if isinstance(value, str) else value
    slug: str | None
    description: str
    language: str
    difficulty: str
    topic: list[str]
    examples: list[dict] | dict
    constraints: str | None
    external_id: int | None
    source_url: str | None
    source: str
    sort_order: int | None
    is_published: bool
    created_at: datetime
    starter_code: str | None = None
    entry_function: str | None = None
    test_call: str | None = None

    model_config = {"from_attributes": True}


class ProblemOut(ProblemPublicOut):
    """Full problem record including stored hints (admin/seeds)."""

    hints: list[str] | None = None


class TagCount(BaseModel):
    tag: str
    count: int


class ProblemFacets(BaseModel):
    total: int
    by_difficulty: dict[str, int]
    by_language: dict[str, int]
    solved_count: int
    unsolved_count: int
    popular_tags: list[TagCount] = []


class ProblemTagsOut(BaseModel):
    tags: list[TagCount]
    suggested: list[str]


class ProblemListOut(BaseModel):
    items: list[ProblemListItem]
    total: int
    page: int
    page_size: int


class ProblemCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=10_000)
    language: Literal["python", "sql"]
    difficulty: Literal["beginner", "easy", "medium", "hard"]
    topic: list[str] = []
    examples: list[dict] = []
    constraints: str | None = Field(None, max_length=2_000)


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
