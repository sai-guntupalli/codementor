"""Tests for active learning path resolution."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from core.active_path import infer_path_from_recent_problems, resolve_active_learning_path
from models.users import User
from schemas.learning_path import LearningPathOut, LearningPathProgress
from tests.test_learning_paths import (
    _add_problem_to_path,
    _make_curated_path,
    _make_other_user,
    _make_personalized_path,
    _make_problem,
)


def _path_out(
    path_id: uuid.UUID,
    *,
    title: str,
    path_type: str = "curated",
    solved: int = 0,
    total: int = 5,
) -> LearningPathOut:
    pct = round(solved / total * 100) if total else 0
    return LearningPathOut(
        id=path_id,
        title=title,
        description=None,
        type=path_type,
        created_by=None,
        is_public=True,
        sort_order=1,
        created_at=datetime.now(UTC),
        progress=LearningPathProgress(
            solved_count=solved, total_count=total, progress_pct=pct
        ),
    )


def test_infer_path_from_recent_submission(db: Session):
    user = _make_other_user(db)
    p_personal = _make_personalized_path(db, user.id)
    p_arrays = _make_curated_path(db, title="Lists & Arrays")
    problem_personal = _make_problem(db)
    problem_arrays = _make_problem(db)
    _add_problem_to_path(db, p_personal.id, problem_personal.id)
    _add_problem_to_path(db, p_arrays.id, problem_arrays.id)

    paths = [
        _path_out(p_personal.id, title="Personalized", path_type="personalized", solved=3),
        _path_out(p_arrays.id, title="Lists & Arrays", solved=1),
    ]
    inferred = infer_path_from_recent_problems(
        db, paths, [problem_arrays.id, problem_personal.id]
    )
    assert inferred is not None
    assert inferred.title == "Lists & Arrays"


def test_resolve_prefers_user_focus(db: Session):
    p_a = _make_curated_path(db, title="Path A")
    p_b = _make_curated_path(db, title="Path B")
    problem = _make_problem(db)
    _add_problem_to_path(db, p_a.id, problem.id)
    _add_problem_to_path(db, p_b.id, problem.id)

    user = User(
        id=uuid.uuid4(),
        email=f"focus-{uuid.uuid4().hex[:6]}@test.com",
        profile_level="student",
        skill_level={},
        active_learning_path_id=p_b.id,
    )
    db.add(user)
    db.commit()

    paths = [
        _path_out(p_a.id, title="Path A", solved=5),
        _path_out(p_b.id, title="Path B", solved=1),
    ]
    active = resolve_active_learning_path(
        db,
        paths,
        preferred_path_id=user.active_learning_path_id,
        recent_problem_ids=[],
    )
    assert active is not None
    assert active.id == p_b.id


def test_focus_endpoint_updates_dashboard(auth_client, db: Session):
    from tests.test_learning_paths import _make_curated_path, _make_problem, _add_problem_to_path

    path = _make_curated_path(db, title="Arrays Track")
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    assert auth_client.post(f"/learning-paths/{path.id}/focus").status_code == 204

    dash = auth_client.get("/dashboard/me").json()
    assert dash["active_path_id"] == str(path.id)
    assert len(dash["active_path_problems"]) >= 1
