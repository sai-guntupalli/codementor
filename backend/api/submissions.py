import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from llm.openrouter import stream_chat
from llm.registry import load_and_render
from llm.review import build_code_review_variables, extract_improved_code
from llm.router import resolve_model
from llm.skill import assess_submission
from llm.usage import log_usage_event
from models.learning import Problem, Submission
from models.users import User
from fastapi import Query
from schemas.submission import SubmissionCreate, SubmissionHistoryItem, SubmissionOut, SolvedProblemIdsOut

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.get("/me", response_model=list[SubmissionHistoryItem])
def list_my_submissions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
) -> list[SubmissionHistoryItem]:
    rows = (
        db.query(Submission, Problem.title)
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(Submission.user_id == current_user.id)
        .order_by(Submission.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        SubmissionHistoryItem(
            id=sub.id,
            problem_id=sub.problem_id,
            problem_title=title,
            language=sub.language,
            score=sub.score,
            hints_used=sub.hints_used,
            solution_viewed=sub.solution_viewed,
            created_at=sub.created_at,
        )
        for sub, title in rows
    ]


@router.get("/me/problem-ids", response_model=SolvedProblemIdsOut)
def list_my_solved_problem_ids(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SolvedProblemIdsOut:
    rows = (
        db.query(Submission.problem_id)
        .filter(Submission.user_id == current_user.id)
        .distinct()
        .all()
    )
    return SolvedProblemIdsOut(solved_ids=[r.problem_id for r in rows])


@router.post("", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    body: SubmissionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionOut:
    submission = Submission(
        user_id=current_user.id,
        problem_id=body.problem_id,
        code=body.code,
        language=body.language,
    )
    db.add(submission)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid user_id or problem_id",
        ) from exc
    db.refresh(submission)
    return submission


@router.post("/{submission_id}/review")
async def review_submission(
    submission_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """
    PRAC-03: Stream a code review for a submission; persist llm_review on completion.
    """
    submission = (
        db.query(Submission)
        .filter(Submission.id == submission_id, Submission.user_id == current_user.id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    variables = build_code_review_variables(submission, problem, current_user)
    rendered = load_and_render(db, "code_review", variables)
    model = resolve_model(db, current_user)
    messages = [{"role": "user", "content": rendered}]

    async def event_generator():
        parts: list[str] = []
        usage_meta: dict | None = None
        total_tokens = 0

        async for token, usage in stream_chat(model=model, messages=messages):
            if usage is not None:
                usage_meta = usage
                continue
            if token:
                parts.append(token)
                total_tokens += max(1, len(token.split()))
                yield f"data: {json.dumps({'token': token})}\n\n"

        review_text = "".join(parts)
        submission.llm_review = review_text
        submission.llm_model_used = model
        submission.improved_code = extract_improved_code(review_text, submission.language)
        db.add(submission)
        db.commit()
        db.refresh(submission)

        if usage_meta:
            total_tokens = int(
                usage_meta.get("total_tokens")
                or usage_meta.get("completion_tokens")
                or total_tokens
            )
            cost = float(usage_meta.get("cost") or 0.0)
        else:
            cost = 0.0

        log_usage_event(
            db,
            user=current_user,
            event_type="code_review",
            prompt_name="code_review",
            llm_model=model,
            tokens_used=total_tokens,
            cost_usd=cost,
        )

        skill = assess_submission(db, submission, problem, current_user)

        done = {
            "type": "done",
            "submission_id": str(submission.id),
            "model": model,
            "tokens_used": total_tokens,
            "xp_earned": skill["xp_earned"],
            "score": skill["score"],
        }
        yield f"data: {json.dumps(done)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
