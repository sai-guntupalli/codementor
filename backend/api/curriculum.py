import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.content import CurriculumPath
from models.learning import Problem
from models.users import User
from schemas.curriculum import CurriculumPathDetailOut, CurriculumPathOut
from schemas.problem import ProblemOut

router = APIRouter(prefix="/curriculum-paths", tags=["curriculum"])


@router.get("", response_model=list[CurriculumPathOut])
def list_paths(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[CurriculumPathOut]:
    del current_user
    return db.query(CurriculumPath).filter(CurriculumPath.is_published.is_(True)).all()


@router.get("/{path_id}", response_model=CurriculumPathDetailOut)
def get_path(
    path_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CurriculumPathDetailOut:
    del current_user
    path = (
        db.query(CurriculumPath)
        .filter(CurriculumPath.id == path_id, CurriculumPath.is_published.is_(True))
        .first()
    )
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Curriculum path {path_id} not found",
        )

    problem_id_to_obj: dict[uuid.UUID, Problem] = {}
    if path.ordered_problem_ids:
        db_problems = db.query(Problem).filter(Problem.id.in_(path.ordered_problem_ids)).all()
        problem_id_to_obj = {p.id: p for p in db_problems}

    ordered_problems = [
        problem_id_to_obj[pid]
        for pid in (path.ordered_problem_ids or [])
        if pid in problem_id_to_obj
    ]

    return CurriculumPathDetailOut(
        id=path.id,
        language=path.language,
        title=path.title,
        ordered_problem_ids=path.ordered_problem_ids or [],
        target_level=path.target_level,
        description=path.description,
        is_published=path.is_published,
        problems=[ProblemOut.model_validate(p) for p in ordered_problems],
    )
