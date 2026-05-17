import uuid

from pydantic import BaseModel

from schemas.problem import ProblemOut


class CurriculumPathOut(BaseModel):
    id: uuid.UUID
    language: str
    title: str
    ordered_problem_ids: list[uuid.UUID]
    target_level: str
    description: str | None
    is_published: bool

    model_config = {"from_attributes": True}


class CurriculumPathDetailOut(BaseModel):
    id: uuid.UUID
    language: str
    title: str
    ordered_problem_ids: list[uuid.UUID]
    target_level: str
    description: str | None
    is_published: bool
    problems: list[ProblemOut]

    model_config = {"from_attributes": True}
