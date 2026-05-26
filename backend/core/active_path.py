"""Pick which learning path to highlight — mirrors frontend/lib/learning-path-utils.ts."""

from __future__ import annotations

from schemas.learning_path import LearningPathOut

_TYPE_PRIORITY = {"personalized": 0, "curated": 1, "custom": 2}


def pick_active_learning_path(paths: list[LearningPathOut]) -> LearningPathOut | None:
    with_problems = [p for p in paths if p.progress.total_count > 0]
    if not with_problems:
        return None

    in_progress = [
        p
        for p in with_problems
        if 0 < p.progress.progress_pct < 100
    ]
    if in_progress:
        return sorted(
            in_progress,
            key=lambda p: (
                _TYPE_PRIORITY.get(p.type, 9),
                -p.progress.progress_pct,
            ),
        )[0]

    for path_type in ("personalized", "curated"):
        match = next((p for p in with_problems if p.type == path_type), None)
        if match:
            return match

    return with_problems[0]
