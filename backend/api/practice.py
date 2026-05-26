"""Practice-flow LLM endpoints (hints, solutions, teach, chat, surprise)."""

import json
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from llm.hints import ensure_problem_hints
from llm.openrouter import stream_chat
from llm.practice import (
    EXPLAIN_STYLES,
    SOLUTION_LEVELS,
    get_stored_hint,
    parse_surprise_problem_json,
    problem_text,
    solution_variables,
    surprise_variables,
    teach_variables,
)
from llm.pricing import compute_cost
from llm.quota import QuotaStatus, require_quota
from llm.registry import load_and_render, prompt_max_tokens
from llm.router import resolve_model
from llm.streaming import (
    log_stream_usage,
    sse_response,
    stream_llm_to_sse,
    stream_static_to_sse,
)
from models.learning import Problem, Submission
from models.users import User
from schemas.practice import (
    ChatRequest,
    CodeReviewRequest,
    HintRequest,
    SolutionRequest,
    SurpriseRequest,
    TeachRequest,
)

router = APIRouter(prefix="/problems", tags=["practice"])


def _get_problem(db: Session, problem_id: uuid.UUID) -> Problem:
    problem = (
        db.query(Problem)
        .filter(Problem.id == problem_id, Problem.is_published.is_(True))
        .first()
    )
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return problem


async def _stream_with_usage_log(
    db: Session,
    user: User,
    *,
    event_type: str,
    prompt_name: str,
    model: str,
    messages: list[dict[str, str]],
    quota_status: QuotaStatus,
    problem_id: uuid.UUID | None = None,
    max_tokens: int | None = None,
) -> AsyncIterator[str]:
    total_tokens = 0
    cost = 0.0
    input_tokens = 0
    output_tokens = 0
    async for line in stream_llm_to_sse(
        model=model,
        messages=messages,
        problem_id=problem_id,
        max_tokens=max_tokens,
        quota_status=quota_status,
    ):
        if line.startswith("data: "):
            payload = json.loads(line[6:].strip())
            if payload.get("type") == "done":
                total_tokens = int(payload.get("tokens_used", 0))
                cost = float(payload.get("cost_usd", 0.0))
                input_tokens = int(payload.get("input_tokens", 0))
                output_tokens = int(payload.get("output_tokens", 0))
        yield line
    log_stream_usage(
        db,
        user=user,
        event_type=event_type,
        prompt_name=prompt_name,
        model=model,
        tokens_used=total_tokens,
        cost_usd=cost,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        problem_id=problem_id,
    )


@router.post("/surprise-me")
async def surprise_me(
    body: SurpriseRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quota_status: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """PRAC-08: Generate a tailored problem and save it with source=llm."""
    recent = (
        db.query(Problem.id)
        .filter(Problem.created_by == current_user.id, Problem.source == "llm")
        .order_by(Problem.created_at.desc())
        .limit(10)
        .all()
    )
    avoid_ids = [row[0] for row in recent]
    variables = surprise_variables(
        current_user, body.language, body.topic_focus, avoid_ids
    )
    rendered = load_and_render(db, "surprise_me", variables)
    model = resolve_model(db, current_user)
    max_tokens = prompt_max_tokens(db, "surprise_me")
    messages = [{"role": "user", "content": rendered}]

    async def event_generator():
        parts: list[str] = []
        usage_meta: dict | None = None
        total_tokens = 0

        async for token, usage in stream_chat(
            model=model, messages=messages, max_tokens=max_tokens
        ):
            if usage is not None:
                usage_meta = usage
                continue
            if token:
                parts.append(token)
                total_tokens += max(1, len(token.split()))
                yield f"data: {json.dumps({'token': token})}\n\n"

        raw = "".join(parts)
        problem_id: str | None = None
        parse_error: str | None = None
        try:
            data = parse_surprise_problem_json(raw)
            problem = Problem(
                title=data.get("title", "Surprise Problem"),
                description=data.get("description", raw),
                language=body.language,
                difficulty=data.get("difficulty", "easy"),
                topic=data.get("topic", []),
                examples=data.get("examples", {}),
                constraints=data.get("constraints"),
                source="llm",
                created_by=current_user.id,
                is_published=True,
            )
            db.add(problem)
            db.commit()
            db.refresh(problem)
            problem_id = str(problem.id)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            parse_error = str(exc)

        input_tokens = 0
        output_tokens = 0
        if usage_meta:
            input_tokens = int(
                usage_meta.get("prompt_tokens") or usage_meta.get("input_tokens") or 0
            )
            output_tokens = int(
                usage_meta.get("completion_tokens") or usage_meta.get("output_tokens") or 0
            )
            total_tokens = input_tokens + output_tokens or int(
                usage_meta.get("total_tokens") or total_tokens
            )
            cost = float(usage_meta.get("cost") or 0.0)
            if cost == 0.0 and (input_tokens > 0 or output_tokens > 0):
                cost = compute_cost(model, input_tokens, output_tokens)
        else:
            cost = 0.0

        log_stream_usage(
            db,
            user=current_user,
            event_type="surprise_me",
            prompt_name="surprise_me",
            model=model,
            tokens_used=total_tokens,
            cost_usd=cost,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        done: dict = {
            "type": "done",
            "model": model,
            "tokens_used": total_tokens,
            "cost_usd": cost,
            "problem_id": problem_id,
            "calls_remaining": max(
                0, quota_status.calls_limit - quota_status.calls_used - 1
            ),
        }
        if quota_status.pct_used >= 0.8:
            done["quota_warning"] = True
        if parse_error:
            done["parse_error"] = parse_error
        yield f"data: {json.dumps(done)}\n\n"

    return sse_response(event_generator())


@router.post("/{problem_id}/hint")
async def request_hint(
    problem_id: uuid.UUID,
    body: HintRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    _quota: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """PRAC-04: Progressive hint from problems.hints; lazy-generates all 3 on first use."""
    problem = _get_problem(db, problem_id)
    try:
        problem = await ensure_problem_hints(db, problem, current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate hints: {exc}",
        ) from exc

    stored = get_stored_hint(problem, body.hint_number)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hint {body.hint_number} is not available.",
        )

    async def event_generator():
        async for line in stream_static_to_sse(stored):
            yield line

        submission = (
            db.query(Submission)
            .filter(
                Submission.user_id == current_user.id,
                Submission.problem_id == problem_id,
            )
            .order_by(Submission.created_at.desc())
            .first()
        )
        if submission and body.hint_number > submission.hints_used:
            submission.hints_used = body.hint_number
            db.add(submission)
            db.commit()

    return sse_response(event_generator())


@router.post("/{problem_id}/solution")
async def request_solution(
    problem_id: uuid.UUID,
    body: SolutionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quota_status: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """PRAC-05: Stream a solution at the chosen depth level."""
    if body.solution_level not in SOLUTION_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"solution_level must be one of: {', '.join(sorted(SOLUTION_LEVELS))}",
        )
    problem = _get_problem(db, problem_id)
    variables = solution_variables(problem, current_user, body.solution_level)
    rendered = load_and_render(db, "solution_generator", variables)
    model = resolve_model(db, current_user)
    max_tokens = prompt_max_tokens(db, "solution_generator")
    messages = [{"role": "user", "content": rendered}]

    async def event_generator():
        async for line in _stream_with_usage_log(
            db,
            current_user,
            event_type="solution",
            prompt_name="solution_generator",
            model=model,
            messages=messages,
            quota_status=quota_status,
            problem_id=problem_id,
            max_tokens=max_tokens,
        ):
            yield line

        submission = (
            db.query(Submission)
            .filter(
                Submission.user_id == current_user.id,
                Submission.problem_id == problem_id,
            )
            .order_by(Submission.created_at.desc())
            .first()
        )
        if submission:
            submission.solution_viewed = True
            submission.solution_level = body.solution_level
            db.add(submission)
            db.commit()

    return sse_response(event_generator())


@router.post("/{problem_id}/teach")
async def teach_me(
    problem_id: uuid.UUID,
    body: TeachRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quota_status: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """PRAC-06: Line-by-line explanation of the user's code."""
    if body.explain_style not in EXPLAIN_STYLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"explain_style must be one of: {', '.join(sorted(EXPLAIN_STYLES))}",
        )
    problem = _get_problem(db, problem_id)
    variables = teach_variables(
        current_user, body.code, problem.language, body.explain_style
    )
    rendered = load_and_render(db, "teach_me", variables)
    model = resolve_model(db, current_user)
    max_tokens = prompt_max_tokens(db, "teach_me")
    messages = [{"role": "user", "content": rendered}]

    return sse_response(
        _stream_with_usage_log(
            db,
            current_user,
            event_type="teach_me",
            prompt_name="teach_me",
            model=model,
            messages=messages,
            quota_status=quota_status,
            problem_id=problem_id,
            max_tokens=max_tokens,
        )
    )


@router.post("/{problem_id}/code-review")
async def code_quality_review(
    problem_id: uuid.UUID,
    body: CodeReviewRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quota_status: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """PRAC-09: Code quality review — what's good, what's wrong, what to improve."""
    problem = _get_problem(db, problem_id)
    prompt = (
        f"You are a code quality mentor. Review the student's solution and give structured feedback.\n\n"
        f"**Problem:** {problem.title}\n{problem.description}\n\n"
        f"**Student's {problem.language} solution:**\n"
        f"```{problem.language}\n{body.code}\n```\n\n"
        "Use exactly these markdown sections (skip any that don't apply):\n\n"
        "## ✅ What's Good\n"
        "Correct logic, clean style, or smart choices worth calling out.\n\n"
        "## ⚠️ Issues\n"
        "Bugs, wrong output, missed edge cases — be specific.\n\n"
        "## 💡 Improvements\n"
        "Concrete suggestions: better names, idiomatic style, efficiency gains, readability.\n\n"
        "## 📊 Complexity\n"
        "Time and space complexity in one line each.\n\n"
        "Be direct and concise. Focus on what will help the student grow."
    )
    model = resolve_model(db, current_user)
    messages = [{"role": "user", "content": prompt}]

    return sse_response(
        _stream_with_usage_log(
            db,
            current_user,
            event_type="code_quality_review",
            prompt_name="code_quality_review",
            model=model,
            messages=messages,
            quota_status=quota_status,
            problem_id=problem_id,
            max_tokens=prompt_max_tokens(db, "code_review"),
        )
    )


@router.post("/{problem_id}/chat")
async def practice_chat(
    problem_id: uuid.UUID,
    body: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quota_status: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """PRAC-07: Freeform Q&A about the current problem."""
    problem = _get_problem(db, problem_id)
    model = resolve_model(db, current_user)
    system = (
        f"You are a helpful coding tutor. The learner is working on this problem "
        f"({problem.language}, {problem.difficulty}):\n\n{problem_text(problem)}\n\n"
        f"Learner profile: {current_user.profile_level}. "
        "Answer clearly; use examples when helpful. Do not give full solutions unless asked."
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for msg in body.history[-20:]:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    return sse_response(
        _stream_with_usage_log(
            db,
            current_user,
            event_type="practice_chat",
            prompt_name="freeform",
            model=model,
            messages=messages,
            quota_status=quota_status,
            problem_id=problem_id,
            max_tokens=600,
        )
    )
