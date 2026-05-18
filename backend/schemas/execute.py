from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    language: str
    code: str = Field(..., max_length=32_000)


class ExecuteResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int | None
    timed_out: bool
