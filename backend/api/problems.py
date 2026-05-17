import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.learning import Problem
from models.users import User
from schemas.problem import ProblemListOut, ProblemOut

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
