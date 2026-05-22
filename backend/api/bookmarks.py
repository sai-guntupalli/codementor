"""Problem bookmarks — save/unsave problems for later."""
# To register this router, add to main.py:
#   from api.bookmarks import router as bookmarks_router
#   app.include_router(bookmarks_router)

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.learning import Problem, ProblemBookmark
from models.users import User

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


class BookmarkOut(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    created_at: str

    model_config = {"from_attributes": True}


class BookmarkedProblemOut(BaseModel):
    bookmark_id: uuid.UUID
    problem_id: uuid.UUID
    title: str
    difficulty: str
    language: str
    topic: list[str]
    bookmarked_at: str


@router.get("", response_model=list[BookmarkedProblemOut])
def list_bookmarks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[BookmarkedProblemOut]:
    rows = (
        db.query(ProblemBookmark, Problem)
        .join(Problem, ProblemBookmark.problem_id == Problem.id)
        .filter(ProblemBookmark.user_id == current_user.id)
        .order_by(ProblemBookmark.created_at.desc())
        .all()
    )
    return [
        BookmarkedProblemOut(
            bookmark_id=bm.id,
            problem_id=p.id,
            title=p.title,
            difficulty=p.difficulty,
            language=p.language,
            topic=p.topic or [],
            bookmarked_at=bm.created_at.isoformat(),
        )
        for bm, p in rows
    ]


@router.post("/{problem_id}", response_model=BookmarkOut, status_code=status.HTTP_201_CREATED)
def add_bookmark(
    problem_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BookmarkOut:
    problem = db.query(Problem).filter(Problem.id == problem_id, Problem.is_published.is_(True)).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    existing = db.query(ProblemBookmark).filter(
        ProblemBookmark.user_id == current_user.id,
        ProblemBookmark.problem_id == problem_id,
    ).first()
    if existing:
        return BookmarkOut(
            id=existing.id,
            problem_id=existing.problem_id,
            created_at=existing.created_at.isoformat(),
        )

    bookmark = ProblemBookmark(user_id=current_user.id, problem_id=problem_id)
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return BookmarkOut(
        id=bookmark.id,
        problem_id=bookmark.problem_id,
        created_at=bookmark.created_at.isoformat(),
    )


@router.delete("/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_bookmark(
    problem_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    bookmark = db.query(ProblemBookmark).filter(
        ProblemBookmark.user_id == current_user.id,
        ProblemBookmark.problem_id == problem_id,
    ).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()


@router.get("/ids", response_model=list[uuid.UUID])
def list_bookmarked_problem_ids(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[uuid.UUID]:
    """Lightweight endpoint — returns just the problem IDs the user has bookmarked."""
    rows = (
        db.query(ProblemBookmark.problem_id)
        .filter(ProblemBookmark.user_id == current_user.id)
        .all()
    )
    return [r.problem_id for r in rows]
