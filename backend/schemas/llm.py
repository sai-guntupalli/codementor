from pydantic import BaseModel, Field


class LLMStreamRequest(BaseModel):
    prompt_name: str = Field(..., description="DB prompt name, e.g. code_review")
    variables: dict[str, str] = Field(default_factory=dict)
    model: str | None = Field(None, description="Override user default; must be plan-allowed")


class LLMStreamDone(BaseModel):
    type: str = "done"
    model: str
    prompt_name: str
    tokens_used: int
