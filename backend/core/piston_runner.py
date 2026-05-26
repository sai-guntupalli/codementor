"""Run code via Piston (shared by /execute and submission verify)."""

import re

import httpx
from fastapi import HTTPException

from api.stdin_util import normalize_stdin
from core.config import settings
from core.function_fixture import stdin_looks_like_assignment_fixture
from core.python_harness import (
    stdin_looks_like_function_call,
    stdin_looks_like_literal,
    wrap_python_function_harness,
)
from schemas.execute import ExecuteResult

PISTON_RUNTIMES: dict[str, tuple[str, str]] = {
    "python": ("python", "3.10.0"),
}
PISTON_HTTP_TIMEOUT = 15.0
PISTON_COMPILE_TIMEOUT = 3000
PISTON_RUN_TIMEOUT = 3000


def is_runnable_example(input_text: str) -> bool:
    """Match frontend execute-api heuristics for stdin and function-call examples."""
    t = input_text.strip()
    if not t or t == "(none)" or re.search(r"see description", t, re.I):
        return False
    if (
        stdin_looks_like_function_call(t)
        or stdin_looks_like_literal(t)
        or stdin_looks_like_assignment_fixture(t)
    ):
        return True
    if re.search(r"\w\s*\(", t):
        return False
    if re.match(r"^[a-z_][\w]*\s*=", t, re.I):
        return False
    if re.search(r"^(def|class|import|from)\b", t, re.M):
        return False
    return True


def normalize_output(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.split("\n")).strip()


async def run_code(
    *,
    language: str,
    code: str,
    stdin: str = "",
) -> ExecuteResult:
    if language not in PISTON_RUNTIMES:
        raise HTTPException(
            status_code=422,
            detail=f"Language '{language}' is not supported for execution.",
        )

    runtime, version = PISTON_RUNTIMES[language]
    run_stdin = normalize_stdin(stdin)
    run_code_body = code
    harnessed = False

    if language == "python":
        wrapped = wrap_python_function_harness(code, stdin)
        if wrapped is not None:
            run_code_body = wrapped
            run_stdin = ""
            harnessed = True

    payload = {
        "language": runtime,
        "version": version,
        "files": [{"name": "main.py", "content": run_code_body}],
        "stdin": run_stdin,
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
