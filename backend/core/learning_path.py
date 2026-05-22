"""Personalized problem ranking for learning paths and browse sort."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from models.learning import LearningPath, LearningPathProblem, LearningPathType, Problem

if TYPE_CHECKING:
    from models.users import User

PERSONALIZED_PATH_TITLE = "Your Learning Path"

# Wider bands so large libraries (e.g. Leetcode ingest) stay reachable per experience level.
EXPERIENCE_TO_DIFFICULTIES: dict[str, list[str]] = {
    "none": ["beginner", "easy"],
    "some": ["beginner", "easy", "medium"],
    "comfortable": ["easy", "medium"],
    "professional": ["medium", "hard"],
}

GOAL_TOPIC_BOOST: dict[str, list[str]] = {
    "job": ["arrays", "hash-map", "binary-tree", "graph", "dynamic-programming", "recursion"],
    "improve": ["dynamic-programming", "graph", "recursion", "sorting", "binary-search"],
    "fun": ["strings", "math", "puzzles", "loops"],
    "course": ["strings", "arrays", "loops", "functions", "math"],
}

PATH_SIZE = 15
NEXT_SIZE = 12
CANDIDATE_POOL = 500

EXPERIENCE_MESSAGES: dict[str, str] = {
    "none": "Here's your beginner-friendly path — no prior experience needed.",
    "some": "Problems selected to build on what you already know.",
    "comfortable": "A mix of easy and medium problems to sharpen your skills.",
    "professional": "Challenging problems to level up your interview readiness.",
}


def difficulties_for_user(user: User) -> list[str]:
    experience = user.coding_experience or "none"
    return EXPERIENCE_TO_DIFFICULTIES.get(experience, ["beginner", "easy"])


def score_problem(problem: Problem, user: User) -> int:
    interested = set(user.interested_topics or [])
    goal = user.learning_goal or "fun"
    boosted = set(GOAL_TOPIC_BOOST.get(goal, []))
    p_topics = set(problem.topic or [])
    s = 0
    if p_topics & interested:
        s += 3
    if p_topics & set(boosted):
        s += 2
    if problem.sort_order is not None:
        s += 1
    return s


def fetch_ranked_candidates(
    db: Session,
    user: User,
    *,
    limit: int = CANDIDATE_POOL,
) -> list[Problem]:
    difficulties = difficulties_for_user(user)
    candidates = (
        db.query(Problem)
        .filter(Problem.is_published.is_(True), Problem.difficulty.in_(difficulties))
        .order_by(Problem.sort_order.asc().nulls_last(), Problem.title.asc())
        .limit(limit)
        .all()
    )
    candidates.sort(
        key=lambda p: (-score_problem(p, user), p.sort_order is None, p.title.lower()),
    )
    return candidates


def build_learning_path(
    candidates: list[Problem],
    *,
    path_size: int = PATH_SIZE,
    next_size: int = NEXT_SIZE,
) -> tuple[list[Problem], list[Problem]]:
    selected = candidates[:path_size]
    path_ids = {p.id for p in selected}
    next_problems = [p for p in candidates if p.id not in path_ids][:next_size]
    return selected, next_problems


def recommended_id_order(candidates: list[Problem]) -> list[uuid.UUID]:
    return [p.id for p in candidates]


def _get_personalized_path(db: Session, user_id: uuid.UUID) -> LearningPath | None:
    return (
        db.query(LearningPath)
        .filter(
            LearningPath.type == LearningPathType.personalized,
            LearningPath.created_by == user_id,
        )
        .first()
    )


def _replace_path_problems(db: Session, path_id: uuid.UUID, problems: list[Problem]) -> None:
    db.query(LearningPathProblem).filter(LearningPathProblem.learning_path_id == path_id).delete()
    for problem in problems:
        db.add(LearningPathProblem(learning_path_id=path_id, problem_id=problem.id))
    db.flush()


def regenerate_personalized_path(db: Session, user: User) -> LearningPath:
    """Build or refresh the user's persisted personalized path problems."""
    candidates = fetch_ranked_candidates(db, user)
    selected, _ = build_learning_path(candidates)

    path = _get_personalized_path(db, user.id)
    if path is None:
        path = LearningPath(
            title=PERSONALIZED_PATH_TITLE,
            type=LearningPathType.personalized,
            created_by=user.id,
            is_public=False,
        )
        db.add(path)
        db.flush()
    _replace_path_problems(db, path.id, selected)
    db.commit()
    db.refresh(path)
    return path


def ensure_personalized_path(db: Session, user: User) -> LearningPath:
    """Return existing personalized path or create one lazily."""
    path = _get_personalized_path(db, user.id)
    if path is not None:
        return path
    return regenerate_personalized_path(db, user)


def path_problems_ordered(db: Session, path_id: uuid.UUID) -> list[Problem]:
    """Load problems for a path in insertion order."""
    rows = (
        db.query(LearningPathProblem.problem_id)
        .filter(LearningPathProblem.learning_path_id == path_id)
        .order_by(LearningPathProblem.added_at.asc())
        .all()
    )
    if not rows:
        return []
    problem_ids = [row[0] for row in rows]
    problems = db.query(Problem).filter(Problem.id.in_(problem_ids)).all()
    by_id = {p.id: p for p in problems}
    return [by_id[pid] for pid in problem_ids if pid in by_id]


def personalized_path_response(
    db: Session,
    user: User,
) -> tuple[list[Problem], list[Problem], int, list[str]]:
    """Problems, next_problems, library_total, difficulties for legacy GET /users/me/learning-path."""
    path = ensure_personalized_path(db, user)
    selected = path_problems_ordered(db, path.id)
    candidates = fetch_ranked_candidates(db, user)
    path_ids = {p.id for p in selected}
    _, next_problems = build_learning_path(candidates)
    next_filtered = [p for p in next_problems if p.id not in path_ids]
    return selected, next_filtered, len(candidates), difficulties_for_user(user)
