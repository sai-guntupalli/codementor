import json
import os
import re
import uuid
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import case, func, or_, text
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.learning_path import fetch_ranked_candidates, recommended_id_order
from core.problem_tags import (
    CANONICAL_TAGS,
    fetch_tag_counts,
    normalize_topic_query,
)
from db.session import get_db
from models.learning import Problem, ProblemSolution, Submission
from models.users import User
from schemas.problem import (
    ProblemFacets,
    ProblemListItem,
    ProblemListOut,
    ProblemPublicOut,
    ProblemSolutionOut,
    ProblemTagsOut,
    TagCount,
)

router = APIRouter(prefix="/problems", tags=["problems"])

SortOption = Literal["default", "title", "newest", "recommended"]

# Paths that must not be parsed as UUID problem ids (static routes live above /{problem_id}).
_RESERVED_SLUGS = frozenset({"meta", "tags", "facets", "topic-tags"})


def _base_query(db: Session) -> Session:
    return db.query(Problem).filter(Problem.is_published.is_(True))


def _tags_matching_query(
    db: Session,
    raw: str,
    *,
    language: str | None = None,
    difficulty: str | None = None,
) -> list[str]:
    return [
        tag
        for tag, _ in fetch_tag_counts(
            db, language=language, difficulty=difficulty, q=raw, limit=120
        )
    ]


def _apply_filters(
    db: Session,
    query,
    *,
    language: str | None,
    difficulty: str | None,
    topic: str | None,
    q: str | None,
    source: str | None,
):
    if language:
        query = query.filter(Problem.language == language)
    if difficulty:
        query = query.filter(Problem.difficulty == difficulty)
    if topic and topic.strip():
        tags = _tags_matching_query(db, topic, language=language, difficulty=difficulty)
        if tags:
            query = query.filter(Problem.topic.overlap(tags))
        else:
            query = query.filter(text("false"))
    if source:
        query = query.filter(Problem.source == source)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        tags = _tags_matching_query(db, q, language=language, difficulty=difficulty)
        text_match = or_(
            Problem.title.ilike(pattern),
            Problem.slug.ilike(pattern),
        )
        if tags:
            query = query.filter(or_(text_match, Problem.topic.overlap(tags)))
        else:
            query = query.filter(text_match)
    return query


def _solved_ids_subquery(db: Session, user_id: uuid.UUID):
    return (
        db.query(Submission.problem_id)
        .filter(Submission.user_id == user_id)
        .distinct()
        .subquery()
    )


def _problems_facets(
    db: Session,
    current_user: User,
    language: str | None,
    difficulty: str | None,
    topic: str | None,
    q: str | None,
    source: str | None,
) -> ProblemFacets:
    filter_base = _apply_filters(
        db,
        _base_query(db),
        language=language,
        difficulty=difficulty,
        topic=None,
        q=None,
        source=source,
    )
    query = _apply_filters(
        db,
        filter_base,
        language=None,
        difficulty=None,
        topic=topic,
        q=q,
        source=None,
    )
    total = query.count()

    by_difficulty: dict[str, int] = {}
    for diff, count in (
        filter_base.with_entities(Problem.difficulty, func.count())
        .group_by(Problem.difficulty)
        .all()
    ):
        by_difficulty[diff] = count

    by_language: dict[str, int] = {}
    for lang, count in (
        filter_base.with_entities(Problem.language, func.count())
        .group_by(Problem.language)
        .all()
    ):
        by_language[lang] = count

    tag_rows = fetch_tag_counts(
        db, language=language, difficulty=difficulty, limit=28
    )
    popular_tags = [TagCount(tag=t, count=c) for t, c in tag_rows]

    solved_subq = _solved_ids_subquery(db, current_user.id)
    solved_count = (
        query.filter(Problem.id.in_(solved_subq.select())).count()
        if total
        else 0
    )

    return ProblemFacets(
        total=total,
        by_difficulty=by_difficulty,
        by_language=by_language,
        solved_count=solved_count,
        unsolved_count=max(0, total - solved_count),
        popular_tags=popular_tags,
    )


@router.get("/facets", response_model=ProblemFacets)
def problems_facets(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    language: str | None = Query(None),
    difficulty: str | None = Query(None),
    topic: str | None = Query(None),
    q: str | None = Query(None, max_length=120),
    source: str | None = Query(None),
) -> ProblemFacets:
    return _problems_facets(
        db, current_user, language, difficulty, topic, q, source
    )


@router.get("/meta", response_model=ProblemFacets, include_in_schema=False)
def problems_meta(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    language: str | None = Query(None),
    difficulty: str | None = Query(None),
    topic: str | None = Query(None),
    q: str | None = Query(None, max_length=120),
    source: str | None = Query(None),
) -> ProblemFacets:
    """Deprecated alias for /facets."""
    return _problems_facets(
        db, current_user, language, difficulty, topic, q, source
    )


def _list_problem_tags(
    db: Session,
    current_user: User,
    q: str | None,
    language: str | None,
    difficulty: str | None,
    limit: int,
) -> ProblemTagsOut:
    del current_user
    rows = fetch_tag_counts(
        db, language=language, difficulty=difficulty, q=q, limit=limit
    )
    tags = [TagCount(tag=t, count=c) for t, c in rows]

    if q and q.strip():
        needle = normalize_topic_query(q)
        suggested = [
            t for t in CANONICAL_TAGS if needle in t or t in needle
        ][:12]
        if not suggested and tags:
            suggested = [tags[0].tag]
    else:
        suggested = list(CANONICAL_TAGS[:16])

    return ProblemTagsOut(tags=tags, suggested=suggested)


@router.get("/topic-tags", response_model=ProblemTagsOut)
def list_topic_tags(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(None, max_length=60, description="Filter tag names"),
    language: str | None = Query(None),
    difficulty: str | None = Query(None),
    limit: int = Query(30, ge=1, le=80),
) -> ProblemTagsOut:
    return _list_problem_tags(db, current_user, q, language, difficulty, limit)


@router.get("/tags", response_model=ProblemTagsOut, include_in_schema=False)
def list_problem_tags(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(None, max_length=60, description="Filter tag names"),
    language: str | None = Query(None),
    difficulty: str | None = Query(None),
    limit: int = Query(30, ge=1, le=80),
) -> ProblemTagsOut:
    """Deprecated alias for /topic-tags."""
    return _list_problem_tags(db, current_user, q, language, difficulty, limit)


@router.get("", response_model=ProblemListOut)
def list_problems(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    language: str | None = Query(None, description="Filter by language: python|sql"),
    difficulty: str | None = Query(None, description="Filter by difficulty"),
    topic: str | None = Query(None, description="Filter by topic tag"),
    source: str | None = Query(None, description="Filter by source: curated|imported|…"),
    q: str | None = Query(None, max_length=120, description="Search title or slug"),
    unsolved_only: bool = Query(False, description="Hide problems you already submitted"),
    sort: SortOption = Query("default"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
) -> ProblemListOut:
    query = _apply_filters(
        db,
        _base_query(db),
        language=language,
        difficulty=difficulty,
        topic=topic,
        q=q,
        source=source,
    )

    if unsolved_only:
        solved_subq = _solved_ids_subquery(db, current_user.id)
        query = query.filter(~Problem.id.in_(db.query(solved_subq.c.problem_id)))

    total = query.count()

    if sort == "recommended":
        ranked = fetch_ranked_candidates(db, current_user)
        id_order = recommended_id_order(ranked)
        if id_order:
            order_map = {pid: idx for idx, pid in enumerate(id_order)}
            query = query.order_by(
                case(order_map, value=Problem.id, else_=len(id_order)),
                Problem.title.asc(),
            )
        else:
            query = query.order_by(Problem.title.asc())
    elif sort == "title":
        query = query.order_by(Problem.title.asc())
    elif sort == "newest":
        query = query.order_by(Problem.created_at.desc())
    else:
        query = query.order_by(
            Problem.sort_order.asc().nulls_last(),
            Problem.title.asc(),
        )

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return ProblemListOut(
        items=[ProblemListItem.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def _parse_problem_id(raw: str) -> uuid.UUID:
    if raw in _RESERVED_SLUGS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid problem id",
        ) from exc


@router.get("/{problem_id}", response_model=ProblemPublicOut)
def get_problem(
    problem_id: Annotated[str, Path(description="Problem UUID")],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProblemPublicOut:
    del current_user
    pid = _parse_problem_id(problem_id)
    problem = (
        db.query(Problem)
        .filter(Problem.id == pid, Problem.is_published.is_(True))
        .first()
    )
    if not problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem {pid} not found",
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
    problem_id: Annotated[str, Path(description="Problem UUID")],
    variant: Literal["optimal", "clean", "brute_force"],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProblemSolutionOut:
    del current_user
    pid = _parse_problem_id(problem_id)

    problem = db.query(Problem).filter(Problem.id == pid, Problem.is_published.is_(True)).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Problem {pid} not found")

    cached = (
        db.query(ProblemSolution)
        .filter(ProblemSolution.problem_id == pid, ProblemSolution.variant == variant)
        .first()
    )
    if cached:
        return cached

    original = (
        db.query(ProblemSolution)
        .filter(ProblemSolution.problem_id == pid, ProblemSolution.variant == "original")
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
        problem_id=pid,
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
