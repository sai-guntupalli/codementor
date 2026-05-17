from pydantic import BaseModel, Field


class HintRequest(BaseModel):
    code: str = ""
    hint_number: int = Field(ge=1, le=3)


class SolutionRequest(BaseModel):
    solution_level: str = "beginner"


class TeachRequest(BaseModel):
    code: str
    explain_style: str = "simple"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class SurpriseRequest(BaseModel):
    language: str = "python"
    topic_focus: str = ""
