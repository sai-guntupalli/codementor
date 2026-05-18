import uuid
from datetime import datetime

from pydantic import BaseModel


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
    language: str
    score: float | None
    hints_used: int
    solution_viewed: bool
    created_at: datetime
