import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.dashboard_insights import record_last_practice
from core.entitlements import has_ai_submit_review
from core.example_tests import run_problem_examples
from db.session import get_db
from llm.quota import QuotaStatus, require_quota
from llm.registry import load_and_render, prompt_max_tokens
from llm.review import build_code_review_variables, extract_improved_code
from llm.router import resolve_model
from llm.skill import assess_submission, assess_submission_from_tests
from llm.streaming import log_stream_usage, sse_response, stream_llm_to_sse
from models.learning import Problem, Submission
from models.users import User
from schemas.submission import (
    SubmissionCreate,
    SubmissionHistoryItem,
    SubmissionOut,
    SubmissionVerifyOut,
    SolvedProblemIdsOut,
    TestCaseResultOut,
)

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


@router.get("/me/by-problem/{problem_id}", response_model=SubmissionOut)
def get_my_latest_submission_for_problem(
    problem_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionOut:
    """Latest submission for this problem by the current user (code + review + score)."""
    submission = (
        db.query(Submission)
        .filter(
            Submission.user_id == current_user.id,
            Submission.problem_id == problem_id,
        )
        .order_by(Submission.created_at.desc())
        .first()
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No submission found")
    return submission


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
    record_last_practice(
        db, current_user, problem_id=body.problem_id, path_id=None
    )
    return submission


def _build_verify_summary(passed_count: int, total_count: int, results: list) -> str:
    if total_count == 0:
        return (
            "## Result\n\n"
            "This problem has no runnable example tests, so we could not verify your "
            "output automatically. Use **Run** to check your code, or upgrade to Pro for "
            "AI review on submit."
        )
    if passed_count >= total_count:
        verdict = "All runnable test cases passed."
    else:
        verdict = f"{passed_count} of {total_count} runnable test cases passed."
    lines = ["## Result", "", verdict, ""]
    for r in results:
        mark = "✓" if r.passed else "✗"
        lines.append(f"- {mark} Example {r.index + 1}")
        if not r.passed:
            lines.append(f"  - Expected: `{r.expected}`")
            lines.append(f"  - Got: `{r.actual or '(no output)'}`")
    lines.append("")
    lines.append(
        "_Graded by example tests. Upgrade to Pro for AI feedback on correctness and style._"
    )
    return "\n".join(lines)


@router.post("/{submission_id}/verify", response_model=SubmissionVerifyOut)
async def verify_submission(
    submission_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionVerifyOut:
    """
    Grade a submission by running problem examples (no LLM).
    Used for Free-tier submit; does not consume AI quota.
    """
    if has_ai_submit_review(current_user, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your plan includes AI review on submit. Use POST /submissions/{id}/review instead.",
        )

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

    if submission.language != "python":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Automatic verification is only supported for Python problems.",
        )

    results = await run_problem_examples(
        language=submission.language,
        code=submission.code,
        examples=problem.examples,
    )
    passed_count = sum(1 for r in results if r.passed)
    total_count = len(results)
    all_passed = total_count > 0 and passed_count >= total_count

    summary = _build_verify_summary(passed_count, total_count, results)
    submission.llm_review = summary
    submission.llm_model_used = None
    submission.improved_code = None
    db.add(submission)
    db.commit()

    skill = assess_submission_from_tests(
        db,
        submission,
        problem,
        current_user,
        passed_count=passed_count,
        total_count=total_count,
    )
    db.refresh(submission)

    return SubmissionVerifyOut(
        submission_id=submission.id,
        passed_count=passed_count,
        total_count=total_count,
        all_passed=all_passed,
        score=float(skill["score"]),
        xp_earned=int(skill["xp_earned"]),
        results=[TestCaseResultOut.model_validate(r.__dict__) for r in results],
        summary=summary,
    )


@router.post("/{submission_id}/review")
async def review_submission(
    submission_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quota_status: Annotated[QuotaStatus, Depends(require_quota)],
) -> StreamingResponse:
    """Stream AI code review for a submission (active paid plan only)."""
    if not has_ai_submit_review(current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI review on submit requires an active Pro plan. Use verify or upgrade.",
        )

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
    max_tokens = prompt_max_tokens(db, "code_review")
    messages = [{"role": "user", "content": rendered}]

    usage_snapshot: dict[str, int | float] = {}

    def on_complete(review_text: str, _usage_meta: dict | None) -> dict:
        submission.llm_review = review_text
        submission.llm_model_used = model
        submission.improved_code = extract_improved_code(review_text, submission.language)
        db.add(submission)
        db.commit()
        db.refresh(submission)

        skill = assess_submission(db, submission, problem, current_user)
        return {
            "submission_id": str(submission.id),
            "xp_earned": skill["xp_earned"],
            "score": skill["score"],
        }

    async def event_generator():
        async for line in stream_llm_to_sse(
            model=model,
            messages=messages,
            problem_id=problem.id,
            max_tokens=max_tokens,
            quota_status=quota_status,
            on_complete=on_complete,
        ):
            if line.startswith("data: "):
                payload = json.loads(line[6:].strip())
                if payload.get("type") == "done":
                    usage_snapshot["tokens_used"] = int(payload.get("tokens_used", 0))
                    usage_snapshot["cost_usd"] = float(payload.get("cost_usd", 0.0))
                    usage_snapshot["input_tokens"] = int(payload.get("input_tokens", 0))
                    usage_snapshot["output_tokens"] = int(payload.get("output_tokens", 0))
            yield line

        if usage_snapshot:
            log_stream_usage(
                db,
                user=current_user,
                event_type="code_review",
                prompt_name="code_review",
                model=model,
                tokens_used=int(usage_snapshot.get("tokens_used", 0)),
                cost_usd=float(usage_snapshot.get("cost_usd", 0.0)),
                input_tokens=int(usage_snapshot.get("input_tokens", 0)),
                output_tokens=int(usage_snapshot.get("output_tokens", 0)),
                problem_id=problem.id,
            )

    return sse_response(event_generator())
