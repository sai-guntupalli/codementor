"""Pick which learning path to highlight on the dashboard."""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from models.learning import LearningPath, LearningPathProblem, LearningPathType
from schemas.learning_path import LearningPathOut

_TYPE_PRIORITY = {"personalized": 0, "curated": 1, "custom": 2}


def _pick_best_among(candidates: list[LearningPathOut]) -> LearningPathOut:
    """Prefer in-progress paths, then highest completion %, then path type."""
    in_progress = [
        p for p in candidates if 0 < p.progress.progress_pct < 100
    ]
    pool = in_progress or candidates
    return sorted(
        pool,
        key=lambda p: (
            -p.progress.progress_pct,
            _TYPE_PRIORITY.get(p.type, 9),
        ),
    )[0]


def pick_active_learning_path(paths: list[LearningPathOut]) -> LearningPathOut | None:
    """Heuristic fallback when no explicit or inferred path is available."""
    with_problems = [p for p in paths if p.progress.total_count > 0]
    if not with_problems:
        return None

    in_progress = [
        p for p in with_problems if 0 < p.progress.progress_pct < 100
    ]
    if in_progress:
        return _pick_best_among(in_progress)

    for path_type in ("personalized", "curated"):
        match = next((p for p in with_problems if p.type == path_type), None)
        if match:
            return match

    return with_problems[0]


def infer_path_from_recent_problems(
    db: Session,
    paths: list[LearningPathOut],
    recent_problem_ids: list[uuid.UUID],
) -> LearningPathOut | None:
    """Map recent submissions to a learning path (most recent submission wins)."""
    path_by_id = {p.id: p for p in paths}
    visible_ids = [p.id for p in paths if p.progress.total_count > 0]
    if not visible_ids or not recent_problem_ids:
        return None

    rows = (
        db.query(LearningPathProblem.learning_path_id, LearningPathProblem.problem_id)
        .filter(
            LearningPathProblem.problem_id.in_(recent_problem_ids),
            LearningPathProblem.learning_path_id.in_(visible_ids),
        )
        .all()
    )
    problem_to_paths: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    for path_id, problem_id in rows:
        problem_to_paths[problem_id].add(path_id)

    for problem_id in recent_problem_ids:
        candidate_ids = problem_to_paths.get(problem_id)
        if not candidate_ids:
            continue
        candidates = [path_by_id[pid] for pid in candidate_ids if pid in path_by_id]
        if candidates:
            return _pick_best_among(candidates)
    return None


def resolve_active_learning_path(
    db: Session,
    paths: list[LearningPathOut],
    *,
    preferred_path_id: uuid.UUID | None,
    recent_problem_ids: list[uuid.UUID],
) -> LearningPathOut | None:
    """
    1. User's explicitly focused path (Settings / learn / practice)
    2. Path inferred from recent submissions
    3. Legacy heuristic (in-progress, then personalized, etc.)
    """
    path_by_id = {p.id: p for p in paths}

    if preferred_path_id and preferred_path_id in path_by_id:
        preferred = path_by_id[preferred_path_id]
        if preferred.progress.total_count > 0:
            return preferred

    inferred = infer_path_from_recent_problems(db, paths, recent_problem_ids)
    if inferred:
        return inferred

    return pick_active_learning_path(paths)


def set_user_active_learning_path(
    db: Session,
    user_id: uuid.UUID,
    path: LearningPath,
) -> None:
    """Persist focused path; validates visibility."""
    if path.type == LearningPathType.curated:
        if not path.is_public:
            raise ValueError("Curated path is not public")
    elif path.created_by != user_id:
        raise ValueError("User cannot focus this path")

    from models.users import User

    user = db.query(User).filter(User.id == user_id).one()
    user.active_learning_path_id = path.id
    db.commit()
