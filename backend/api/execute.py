from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException

from api.stdin_util import normalize_stdin
from core.config import settings
from core.python_harness import wrap_python_function_harness
from core.deps import get_current_user
from models.users import User
from schemas.execute import ExecuteRequest, ExecuteResult

router = APIRouter(prefix="/execute", tags=["execute"])
SUPPORTED_LANGUAGES = {"python"}
PISTON_RUNTIMES: dict[str, tuple[str, str]] = {
    "python": ("python", "3.10.0"),
}
PISTON_HTTP_TIMEOUT = 15.0
# Default Piston image caps these at 3000ms unless PISTON_MAX_* is raised in docker.
PISTON_COMPILE_TIMEOUT = 3000
PISTON_RUN_TIMEOUT = 3000


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
    code = body.code
    stdin = normalize_stdin(body.stdin)
    harnessed = False
    if body.language == "python":
        wrapped = wrap_python_function_harness(code, body.stdin)
        if wrapped is not None:
            code = wrapped
            stdin = ""
            harnessed = True

    payload = {
        "language": runtime,
        "version": version,
        "files": [{"name": "main.py", "content": code}],
        "stdin": stdin,
        "args": [],
        "compile_timeout": PISTON_COMPILE_TIMEOUT,
        "run_timeout": PISTON_RUN_TIMEOUT,
    }

    try:
        async with httpx.AsyncClient(timeout=PISTON_HTTP_TIMEOUT) as client:
            resp = await client.post(settings.piston_url, json=payload)
            if resp.status_code >= 400:
                detail = resp.text[:500]
                try:
                    msg = resp.json().get("message")
                    if msg:
                        detail = msg
                except Exception:
                    pass
                raise HTTPException(
                    status_code=502,
                    detail=f"Execution service error: {detail}",
                )
            run = resp.json().get("run", {})
        return ExecuteResult(
            stdout=run.get("stdout", ""),
            stderr=run.get("stderr", ""),
            exit_code=run.get("code"),
            timed_out=False,
            harnessed=harnessed,
        )
    except httpx.TimeoutException:
        return ExecuteResult(
            stdout="", stderr="", exit_code=None, timed_out=True, harnessed=harnessed
        )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Execution service error: {exc}") from exc
