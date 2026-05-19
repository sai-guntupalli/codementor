from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException

from core.config import settings
from core.deps import get_current_user
from models.users import User
from schemas.execute import ExecuteRequest, ExecuteResult

router = APIRouter(prefix="/execute", tags=["execute"])
SUPPORTED_LANGUAGES = {"python"}
PISTON_RUNTIMES: dict[str, tuple[str, str]] = {
    "python": ("python", "3.10.0"),
}
PISTON_TIMEOUT = 10.0


@router.post("", response_model=ExecuteResult)
async def execute_code(
    body: ExecuteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ExecuteResult:
    if body.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Language '{body.language}' is not supported for execution.",
        )

    runtime, version = PISTON_RUNTIMES[body.language]
    payload = {
        "language": runtime,
        "version": version,
        "files": [{"content": body.code}],
        "stdin": body.stdin,
        "args": [],
    }

    try:
        async with httpx.AsyncClient(timeout=PISTON_TIMEOUT) as client:
            resp = await client.post(settings.piston_url, json=payload)
            resp.raise_for_status()
        run = resp.json().get("run", {})
        return ExecuteResult(
            stdout=run.get("stdout", ""),
            stderr=run.get("stderr", ""),
            exit_code=run.get("code"),
            timed_out=False,
        )
    except httpx.TimeoutException:
        return ExecuteResult(stdout="", stderr="", exit_code=None, timed_out=True)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Execution service error: {exc}") from exc
