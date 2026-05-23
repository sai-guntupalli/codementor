import uuid

from pydantic import BaseModel, computed_field, field_validator

from core.problem_titles import strip_curriculum_prefix


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None
    profile_level: str
    coding_experience: str | None
    learning_goal: str | None
    interested_topics: list[str] | None
    skill_level: dict
    streak_days: int
    xp_total: int

    @computed_field
    @property
    def is_profile_complete(self) -> bool:
        return self.display_name is not None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = None
    profile_level: str | None = None
    coding_experience: str | None = None
    learning_goal: str | None = None
    interested_topics: list[str] | None = None


class LearningPathProblem(BaseModel):
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

    model_config = {"from_attributes": True}


class LearningPathOut(BaseModel):
    problems: list[LearningPathProblem]
    message: str
    next_problems: list[LearningPathProblem] = []
    library_total: int = 0
    difficulties: list[str] = []
