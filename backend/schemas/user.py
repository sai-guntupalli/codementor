import uuid

from pydantic import BaseModel, computed_field


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None
    profile_level: str
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
