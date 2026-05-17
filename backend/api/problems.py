import json
import os
import re
import uuid
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.learning import Problem, ProblemSolution
from models.users import User
from schemas.problem import ProblemListOut, ProblemOut, ProblemSolutionOut

router = APIRouter(prefix="/problems", tags=["problems"])


@router.get("", response_model=ProblemListOut)
def list_problems(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    language: str | None = Query(None, description="Filter by language: python|sql"),
    difficulty: str | None = Query(None, description="Filter by difficulty: easy|medium|hard"),
    topic: str | None = Query(None, description="Filter by topic tag"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ProblemListOut:
    del current_user
    query = db.query(Problem).filter(Problem.is_published.is_(True))
    if language:
        query = query.filter(Problem.language == language)
    if difficulty:
        query = query.filter(Problem.difficulty == difficulty)
    if topic:
        query = query.filter(Problem.topic.contains([topic]))
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return ProblemListOut(items=items, total=total, page=page, page_size=page_size)


@router.get("/{problem_id}", response_model=ProblemOut)
def get_problem(
    problem_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProblemOut:
    del current_user
    problem = (
        db.query(Problem)
        .filter(Problem.id == problem_id, Problem.is_published.is_(True))
        .first()
    )
    if not problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem {problem_id} not found",
        )
    return problem


_VARIANT_PROMPT = {
    "optimal": (
        "Rewrite the following Python solution to be as time and space efficient as possible. "
        "Return ONLY a JSON object with keys: code (str), time_complexity (str), "
        "space_complexity (str), explanation (str, one paragraph).\n\nOriginal code:\n{code}"
    ),
    "clean": (
        "Rewrite the following Python solution to be maximally readable and idiomatic. "
        "Prioritise clarity over micro-optimisations. "
        "Return ONLY a JSON object with keys: code (str), time_complexity (str), "
        "space_complexity (str), explanation (str, one paragraph).\n\nOriginal code:\n{code}"
    ),
    "brute_force": (
        "Write a simple brute-force Python solution for the following problem description. "
        "Correctness over efficiency. "
        "Return ONLY a JSON object with keys: code (str), time_complexity (str), "
        "space_complexity (str), explanation (str, one paragraph).\n\nProblem:\n{code}"
    ),
}


@router.post("/{problem_id}/solutions/generate", response_model=ProblemSolutionOut)
async def generate_solution_variant(
    problem_id: uuid.UUID,
    variant: Literal["optimal", "clean", "brute_force"],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProblemSolutionOut:
    del current_user

    problem = db.query(Problem).filter(Problem.id == problem_id, Problem.is_published.is_(True)).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Problem {problem_id} not found")

    cached = (
        db.query(ProblemSolution)
        .filter(ProblemSolution.problem_id == problem_id, ProblemSolution.variant == variant)
        .first()
    )
    if cached:
        return cached

    original = (
        db.query(ProblemSolution)
        .filter(ProblemSolution.problem_id == problem_id, ProblemSolution.variant == "original")
        .first()
    )
    source_text = original.code if original else problem.description

    prompt = _VARIANT_PROMPT[variant].format(code=source_text)
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    async with httpx.AsyncClient(timeout=120.0) as http_client:
        resp = await http_client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "anthropic/claude-haiku-4-5",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 2048,
            },
        )
        resp.raise_for_status()

    raw = resp.json()["choices"][0]["message"]["content"]
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    llm_data: dict = json.loads(raw)

    solution = ProblemSolution(
        problem_id=problem_id,
        language="python",
        variant=variant,
        code=llm_data.get("code", ""),
        time_complexity=llm_data.get("time_complexity"),
        space_complexity=llm_data.get("space_complexity"),
        explanation=llm_data.get("explanation"),
        is_primary=False,
    )
    db.add(solution)
    db.commit()
    db.refresh(solution)
    return solution
