import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.learning_path import ensure_personalized_path
from db.session import get_db
from models.learning import LearningPath, LearningPathProblem, LearningPathType, Problem, Submission
from models.users import User
from schemas.learning_path import (
    AddProblemBody,
    LearningPathCreate,
    LearningPathOut,
    LearningPathProblemItem,
    LearningPathProgress,
    LearningPathUpdate,
)

router = APIRouter(prefix="/learning-paths", tags=["learning_paths"])


def _get_solved_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Return set of problem IDs the user has solved (score IS NOT NULL)."""
    rows = (
        db.query(Submission.problem_id)
        .filter(Submission.user_id == user_id, Submission.score.isnot(None))
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def _make_path_out(
    path: LearningPath,
    solved_problem_ids: set[uuid.UUID],
    db: Session,
) -> LearningPathOut:
    problem_ids = (
        db.query(LearningPathProblem.problem_id)
        .filter(LearningPathProblem.learning_path_id == path.id)
        .all()
    )
    total = len(problem_ids)
    solved = sum(1 for (pid,) in problem_ids if pid in solved_problem_ids)
    pct = round(solved / total * 100) if total > 0 else 0
    return LearningPathOut(
        id=path.id,
        title=path.title,
        description=path.description,
        type=path.type.value,
        created_by=path.created_by,
        is_public=path.is_public,
        sort_order=path.sort_order,
        created_at=path.created_at,
        progress=LearningPathProgress(solved_count=solved, total_count=total, progress_pct=pct),
    )


def _get_path_or_404(db: Session, path_id: uuid.UUID) -> LearningPath:
    path = db.query(LearningPath).filter(LearningPath.id == path_id).first()
    if not path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learning path not found")
    return path


def _assert_custom_owner(path: LearningPath, user_id: uuid.UUID) -> None:
    """Raise 403 if path is not custom or user is not the owner."""
    if path.type != LearningPathType.custom:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This path cannot be edited",
        )
    if path.created_by != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this path",
        )


# ---------------------------------------------------------------------------
# Learning Path endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[LearningPathOut])
def list_learning_paths(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[LearningPathOut]:
    """List all paths visible to the current user with per-path progress."""
    ensure_personalized_path(db, current_user)

    curated = (
        db.query(LearningPath)
        .filter(LearningPath.type == LearningPathType.curated)
        .order_by(LearningPath.sort_order.asc().nullslast())
        .all()
    )
    user_paths = (
        db.query(LearningPath)
        .filter(
            LearningPath.created_by == current_user.id,
            LearningPath.type.in_([LearningPathType.personalized, LearningPathType.custom]),
        )
        .all()
    )

    solved_ids = _get_solved_ids(db, current_user.id)
    return [_make_path_out(p, solved_ids, db) for p in curated + user_paths]


@router.post("", response_model=LearningPathOut, status_code=status.HTTP_201_CREATED)
def create_learning_path(
    body: LearningPathCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LearningPathOut:
    """Create a custom learning path for the current user."""
    path = LearningPath(
        title=body.title,
        description=body.description,
        type=LearningPathType.custom,
        created_by=current_user.id,
        is_public=False,
    )
    db.add(path)
    db.commit()
    db.refresh(path)
    solved_ids = _get_solved_ids(db, current_user.id)
    return _make_path_out(path, solved_ids, db)


@router.patch("/{path_id}", response_model=LearningPathOut)
def update_learning_path(
    path_id: uuid.UUID,
    body: LearningPathUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LearningPathOut:
    """Rename/update a custom learning path. Owner only."""
    path = _get_path_or_404(db, path_id)
    _assert_custom_owner(path, current_user.id)

    if body.title is not None:
        path.title = body.title
    if body.description is not None:
        path.description = body.description

    db.commit()
    db.refresh(path)
    solved_ids = _get_solved_ids(db, current_user.id)
    return _make_path_out(path, solved_ids, db)


@router.delete("/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_learning_path(
    path_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a custom learning path. Owner only."""
    path = _get_path_or_404(db, path_id)
    _assert_custom_owner(path, current_user.id)
    db.delete(path)
    db.commit()


# ---------------------------------------------------------------------------
# Problems within a path endpoints
# ---------------------------------------------------------------------------


@router.get("/{path_id}/problems", response_model=list[LearningPathProblemItem])
def list_path_problems(
    path_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[LearningPathProblemItem]:
    """List problems in a learning path with solved status per problem."""
    _get_path_or_404(db, path_id)
    solved_ids = _get_solved_ids(db, current_user.id)

    lpp_rows = (
        db.query(LearningPathProblem)
        .filter(LearningPathProblem.learning_path_id == path_id)
        .all()
    )
    problem_ids = [row.problem_id for row in lpp_rows]
    if not problem_ids:
        return []

    problems = db.query(Problem).filter(Problem.id.in_(problem_ids)).all()
    problem_map = {p.id: p for p in problems}

    result = []
    for pid in problem_ids:
        p = problem_map.get(pid)
        if p is None:
            continue
        result.append(
            LearningPathProblemItem(
                id=p.id,
                title=p.title,
                slug=p.slug,
                difficulty=p.difficulty,
                topic=p.topic or [],
                language=p.language,
                solved=pid in solved_ids,
            )
        )
    return result


@router.post(
    "/{path_id}/problems",
    response_model=LearningPathProblemItem,
    status_code=status.HTTP_201_CREATED,
)
def add_problem_to_path(
    path_id: uuid.UUID,
    body: AddProblemBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LearningPathProblemItem:
    """Add a problem to a custom learning path. Owner only."""
    path = _get_path_or_404(db, path_id)
    _assert_custom_owner(path, current_user.id)

    problem = db.query(Problem).filter(Problem.id == body.problem_id).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    existing = (
        db.query(LearningPathProblem)
        .filter(
            LearningPathProblem.learning_path_id == path_id,
            LearningPathProblem.problem_id == body.problem_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already in this path"
        )

    lpp = LearningPathProblem(learning_path_id=path_id, problem_id=body.problem_id)
    db.add(lpp)
    db.commit()

    solved_ids = _get_solved_ids(db, current_user.id)
    return LearningPathProblemItem(
        id=problem.id,
        title=problem.title,
        slug=problem.slug,
        difficulty=problem.difficulty,
        topic=problem.topic or [],
        language=problem.language,
        solved=problem.id in solved_ids,
    )


@router.delete("/{path_id}/problems/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_problem_from_path(
    path_id: uuid.UUID,
    problem_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Remove a problem from a custom learning path. Owner only."""
    path = _get_path_or_404(db, path_id)
    _assert_custom_owner(path, current_user.id)

    lpp = (
        db.query(LearningPathProblem)
        .filter(
            LearningPathProblem.learning_path_id == path_id,
            LearningPathProblem.problem_id == problem_id,
        )
        .first()
    )
    if not lpp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Problem not in this path"
        )
    db.delete(lpp)
    db.commit()
