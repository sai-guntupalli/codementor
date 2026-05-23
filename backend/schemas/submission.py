import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from core.problem_titles import strip_curriculum_prefix


class SubmissionCreate(BaseModel):
    problem_id: uuid.UUID
    code: str
    language: str


class SubmissionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    problem_id: uuid.UUID
    code: str
    language: str
    llm_review: str | None
    improved_code: str | None
    hints_used: int
    solution_viewed: bool
    score: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmissionHistoryItem(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    problem_title: str

    @field_validator("problem_title", mode="before")
    @classmethod
    def _strip_problem_title(cls, value: object) -> object:
        return strip_curriculum_prefix(value) if isinstance(value, str) else value
    language: str
    score: float | None
    hints_used: int
    solution_viewed: bool
    created_at: datetime


class SolvedProblemIdsOut(BaseModel):
    solved_ids: list[uuid.UUID]
