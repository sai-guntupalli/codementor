"""Tests for /learning-paths endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.learning import LearningPath, LearningPathProblem, LearningPathType, Problem, Submission
from models.users import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_problem(db: Session) -> Problem:
    p = Problem(
        title=f"Test Problem {uuid.uuid4().hex[:6]}",
        description="A test problem description.",
        difficulty="easy",
        language="python",
        source="curated",
        is_published=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_other_user(db: Session) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"other-{uuid.uuid4().hex[:8]}@example.com",
        display_name="Other",
        profile_level="student",
        skill_level={},
        streak_days=0,
        xp_total=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_custom_path(db: Session, user_id: uuid.UUID, title: str = "My Custom Path") -> LearningPath:
    path = LearningPath(
        title=title,
        type=LearningPathType.custom,
        created_by=user_id,
        is_public=False,
    )
    db.add(path)
    db.commit()
    db.refresh(path)
    return path


def _make_curated_path(db: Session, title: str = "Curated Path") -> LearningPath:
    path = LearningPath(
        title=title,
        type=LearningPathType.curated,
        created_by=None,
        is_public=True,
        sort_order=1,
    )
    db.add(path)
    db.commit()
    db.refresh(path)
    return path


def _make_personalized_path(db: Session, user_id: uuid.UUID) -> LearningPath:
    path = LearningPath(
        title="My Personalized Path",
        type=LearningPathType.personalized,
        created_by=user_id,
        is_public=False,
    )
    db.add(path)
    db.commit()
    db.refresh(path)
    return path


def _add_problem_to_path(db: Session, path_id: uuid.UUID, problem_id: uuid.UUID) -> LearningPathProblem:
    lpp = LearningPathProblem(learning_path_id=path_id, problem_id=problem_id)
    db.add(lpp)
    db.commit()
    db.refresh(lpp)
    return lpp


def _make_solved_submission(db: Session, user_id: uuid.UUID, problem_id: uuid.UUID) -> Submission:
    sub = Submission(
        user_id=user_id,
        problem_id=problem_id,
        code="print('hello')",
        language="python",
        score=90.0,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


# ---------------------------------------------------------------------------
# Auth guard
# ---------------------------------------------------------------------------


def test_list_learning_paths_requires_auth(client: TestClient):
    resp = client.get("/learning-paths")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /learning-paths
# ---------------------------------------------------------------------------


def test_list_learning_paths_empty(auth_client: TestClient):
    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_learning_paths_includes_curated(auth_client: TestClient, db: Session):
    _make_curated_path(db, "Algorithms 101")
    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "Algorithms 101" in titles


def test_list_learning_paths_includes_user_custom(
    auth_client: TestClient, db: Session, persisted_user
):
    _make_custom_path(db, persisted_user.id, "My DSA Path")
    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "My DSA Path" in titles


def test_list_learning_paths_excludes_other_user_custom(
    auth_client: TestClient, db: Session
):
    other = _make_other_user(db)
    _make_custom_path(db, other.id, "Other User Path")
    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "Other User Path" not in titles


def test_list_learning_paths_includes_user_personalized(
    auth_client: TestClient, db: Session, persisted_user
):
    _make_personalized_path(db, persisted_user.id)
    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    types = [p["type"] for p in resp.json()]
    assert "personalized" in types


def test_list_learning_paths_progress_structure(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_custom_path(db, persisted_user.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    path_data = next((p for p in resp.json() if p["id"] == str(path.id)), None)
    assert path_data is not None
    progress = path_data["progress"]
    assert progress["total_count"] == 1
    assert progress["solved_count"] == 0
    assert progress["progress_pct"] == 0


def test_list_learning_paths_progress_solved(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_custom_path(db, persisted_user.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)
    _make_solved_submission(db, persisted_user.id, problem.id)

    resp = auth_client.get("/learning-paths")
    path_data = next((p for p in resp.json() if p["id"] == str(path.id)), None)
    assert path_data is not None
    progress = path_data["progress"]
    assert progress["solved_count"] == 1
    assert progress["total_count"] == 1
    assert progress["progress_pct"] == 100


def test_list_learning_paths_curated_sorted_by_sort_order(
    auth_client: TestClient, db: Session
):
    db.add(LearningPath(title="Path B", type=LearningPathType.curated, is_public=True, sort_order=2))
    db.add(LearningPath(title="Path A", type=LearningPathType.curated, is_public=True, sort_order=1))
    db.add(LearningPath(title="Path C", type=LearningPathType.curated, is_public=True, sort_order=None))
    db.commit()

    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    curated = [p for p in resp.json() if p["type"] == "curated"]
    ordered = [p["title"] for p in curated if p["title"] in ("Path A", "Path B", "Path C")]
    assert ordered.index("Path A") < ordered.index("Path B")
    # Path C (null sort_order) should come last
    assert ordered.index("Path B") < ordered.index("Path C")


# ---------------------------------------------------------------------------
# POST /learning-paths
# ---------------------------------------------------------------------------


def test_create_custom_path(auth_client: TestClient):
    resp = auth_client.post("/learning-paths", json={"title": "New Path", "description": "Desc"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "New Path"
    assert body["description"] == "Desc"
    assert body["type"] == "custom"
    assert body["progress"]["total_count"] == 0
    assert body["progress"]["progress_pct"] == 0


def test_create_custom_path_no_description(auth_client: TestClient):
    resp = auth_client.post("/learning-paths", json={"title": "Minimal Path"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Minimal Path"
    assert body["description"] is None


def test_create_custom_path_requires_auth(client: TestClient):
    resp = client.post("/learning-paths", json={"title": "Path"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /learning-paths/{id}
# ---------------------------------------------------------------------------


def test_update_custom_path_title(auth_client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id, "Old Title")
    resp = auth_client.patch(f"/learning-paths/{path.id}", json={"title": "New Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


def test_update_custom_path_description(auth_client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id)
    resp = auth_client.patch(f"/learning-paths/{path.id}", json={"description": "Updated desc"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated desc"


def test_update_path_not_found(auth_client: TestClient):
    resp = auth_client.patch(f"/learning-paths/{uuid.uuid4()}", json={"title": "X"})
    assert resp.status_code == 404


def test_update_curated_path_returns_403(auth_client: TestClient, db: Session):
    path = _make_curated_path(db)
    resp = auth_client.patch(f"/learning-paths/{path.id}", json={"title": "Hacked"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This path cannot be edited"


def test_update_personalized_path_returns_403(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_personalized_path(db, persisted_user.id)
    resp = auth_client.patch(f"/learning-paths/{path.id}", json={"title": "Hacked"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This path cannot be edited"


def test_update_other_user_custom_path_returns_403(
    auth_client: TestClient, db: Session
):
    other = _make_other_user(db)
    path = _make_custom_path(db, other.id, "Theirs")
    resp = auth_client.patch(f"/learning-paths/{path.id}", json={"title": "Mine"})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /learning-paths/{id}
# ---------------------------------------------------------------------------


def test_delete_custom_path(auth_client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id)
    resp = auth_client.delete(f"/learning-paths/{path.id}")
    assert resp.status_code == 204
    # Confirm it's gone
    resp2 = auth_client.get("/learning-paths")
    ids = [p["id"] for p in resp2.json()]
    assert str(path.id) not in ids


def test_delete_path_not_found(auth_client: TestClient):
    resp = auth_client.delete(f"/learning-paths/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_delete_curated_path_returns_403(auth_client: TestClient, db: Session):
    path = _make_curated_path(db)
    resp = auth_client.delete(f"/learning-paths/{path.id}")
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This path cannot be edited"


def test_delete_personalized_path_returns_403(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_personalized_path(db, persisted_user.id)
    resp = auth_client.delete(f"/learning-paths/{path.id}")
    assert resp.status_code == 403


def test_delete_other_user_custom_path_returns_403(
    auth_client: TestClient, db: Session
):
    other = _make_other_user(db)
    path = _make_custom_path(db, other.id)
    resp = auth_client.delete(f"/learning-paths/{path.id}")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /learning-paths/{id}/problems
# ---------------------------------------------------------------------------


def test_get_path_problems_empty(auth_client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id)
    resp = auth_client.get(f"/learning-paths/{path.id}/problems")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_path_problems_with_items(auth_client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.get(f"/learning-paths/{path.id}/problems")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == str(problem.id)
    assert items[0]["solved"] is False


def test_get_path_problems_solved_flag(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_custom_path(db, persisted_user.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)
    _make_solved_submission(db, persisted_user.id, problem.id)

    resp = auth_client.get(f"/learning-paths/{path.id}/problems")
    assert resp.status_code == 200
    items = resp.json()
    assert items[0]["solved"] is True


def test_get_path_problems_path_not_found(auth_client: TestClient):
    resp = auth_client.get(f"/learning-paths/{uuid.uuid4()}/problems")
    assert resp.status_code == 404


def test_get_path_problems_requires_auth(client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id)
    resp = client.get(f"/learning-paths/{path.id}/problems")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /learning-paths/{id}/problems
# ---------------------------------------------------------------------------


def test_add_problem_to_path(auth_client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id)
    problem = _make_problem(db)

    resp = auth_client.post(
        f"/learning-paths/{path.id}/problems", json={"problem_id": str(problem.id)}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] == str(problem.id)
    assert body["title"] == problem.title
    assert "solved" in body


def test_add_problem_duplicate_returns_409(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_custom_path(db, persisted_user.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.post(
        f"/learning-paths/{path.id}/problems", json={"problem_id": str(problem.id)}
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Already in this path"


def test_add_problem_nonexistent_problem_returns_404(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_custom_path(db, persisted_user.id)
    resp = auth_client.post(
        f"/learning-paths/{path.id}/problems", json={"problem_id": str(uuid.uuid4())}
    )
    assert resp.status_code == 404


def test_add_problem_nonexistent_path_returns_404(auth_client: TestClient, db: Session):
    problem = _make_problem(db)
    resp = auth_client.post(
        f"/learning-paths/{uuid.uuid4()}/problems", json={"problem_id": str(problem.id)}
    )
    assert resp.status_code == 404


def test_add_problem_to_curated_path_returns_403(
    auth_client: TestClient, db: Session
):
    path = _make_curated_path(db)
    problem = _make_problem(db)
    resp = auth_client.post(
        f"/learning-paths/{path.id}/problems", json={"problem_id": str(problem.id)}
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This path cannot be edited"


def test_add_problem_to_personalized_path_returns_403(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_personalized_path(db, persisted_user.id)
    problem = _make_problem(db)
    resp = auth_client.post(
        f"/learning-paths/{path.id}/problems", json={"problem_id": str(problem.id)}
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This path cannot be edited"


def test_add_problem_to_other_user_path_returns_403(
    auth_client: TestClient, db: Session
):
    other = _make_other_user(db)
    path = _make_custom_path(db, other.id)
    problem = _make_problem(db)
    resp = auth_client.post(
        f"/learning-paths/{path.id}/problems", json={"problem_id": str(problem.id)}
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /learning-paths/{id}/problems/{problem_id}
# ---------------------------------------------------------------------------


def test_remove_problem_from_path(auth_client: TestClient, db: Session, persisted_user):
    path = _make_custom_path(db, persisted_user.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.delete(f"/learning-paths/{path.id}/problems/{problem.id}")
    assert resp.status_code == 204

    # Verify it's gone
    resp2 = auth_client.get(f"/learning-paths/{path.id}/problems")
    assert resp2.json() == []


def test_remove_problem_not_in_path_returns_404(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_custom_path(db, persisted_user.id)
    resp = auth_client.delete(f"/learning-paths/{path.id}/problems/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_remove_problem_path_not_found_returns_404(auth_client: TestClient):
    resp = auth_client.delete(f"/learning-paths/{uuid.uuid4()}/problems/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_remove_problem_from_curated_path_returns_403(
    auth_client: TestClient, db: Session
):
    path = _make_curated_path(db)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.delete(f"/learning-paths/{path.id}/problems/{problem.id}")
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This path cannot be edited"


def test_remove_problem_from_personalized_path_returns_403(
    auth_client: TestClient, db: Session, persisted_user
):
    path = _make_personalized_path(db, persisted_user.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.delete(f"/learning-paths/{path.id}/problems/{problem.id}")
    assert resp.status_code == 403


def test_remove_problem_from_other_user_path_returns_403(
    auth_client: TestClient, db: Session
):
    other = _make_other_user(db)
    path = _make_custom_path(db, other.id)
    problem = _make_problem(db)
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.delete(f"/learning-paths/{path.id}/problems/{problem.id}")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Personalized path lifecycle
# ---------------------------------------------------------------------------


def test_patch_profile_creates_personalized_path(
    auth_client: TestClient, db: Session, persisted_user
):
    """PATCH /users/me with onboarding data creates the personalized path; GET sees it."""
    for i in range(5):
        db.add(
            Problem(
                title=f"Init {i}",
                description="x" * 20,
                difficulty="beginner",
                language="python",
                source="curated",
                is_published=True,
                sort_order=i,
            )
        )
    db.commit()

    auth_client.patch(
        "/users/me",
        json={"coding_experience": "none", "learning_goal": "fun", "interested_topics": []},
    )

    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    personalized = [p for p in resp.json() if p["type"] == "personalized"]
    assert len(personalized) == 1
    assert personalized[0]["progress"]["total_count"] >= 1


def test_get_learning_paths_does_not_create_path_when_none_exists(
    auth_client: TestClient, db: Session
):
    """GET /learning-paths must not write to DB — personalized path only created via PATCH."""
    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    personalized = [p for p in resp.json() if p["type"] == "personalized"]
    assert len(personalized) == 0


def test_list_learning_paths_progress_multiple_paths(
    auth_client: TestClient, db: Session, persisted_user
):
    """Batch query must compute correct progress for multiple paths simultaneously."""
    path_a = _make_custom_path(db, persisted_user.id, "Alpha")
    path_b = _make_custom_path(db, persisted_user.id, "Beta")
    p1 = _make_problem(db)
    p2 = _make_problem(db)
    p3 = _make_problem(db)
    _add_problem_to_path(db, path_a.id, p1.id)
    _add_problem_to_path(db, path_a.id, p2.id)
    _add_problem_to_path(db, path_b.id, p3.id)
    _make_solved_submission(db, persisted_user.id, p1.id)

    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    paths = {p["id"]: p for p in resp.json()}

    a = paths[str(path_a.id)]
    assert a["progress"]["total_count"] == 2
    assert a["progress"]["solved_count"] == 1
    assert a["progress"]["progress_pct"] == 50

    b = paths[str(path_b.id)]
    assert b["progress"]["total_count"] == 1
    assert b["progress"]["solved_count"] == 0
    assert b["progress"]["progress_pct"] == 0


def test_learning_path_endpoint_uses_persisted_path(
    auth_client: TestClient, db: Session, persisted_user
):
    for i in range(4):
        db.add(
            Problem(
                title=f"Persist {i}",
                description="x" * 20,
                difficulty="beginner",
                language="python",
                source="curated",
                is_published=True,
                sort_order=i,
            )
        )
    db.commit()

    resp1 = auth_client.get("/users/me/learning-path")
    assert resp1.status_code == 200
    count1 = len(resp1.json()["problems"])

    resp2 = auth_client.get("/users/me/learning-path")
    assert resp2.status_code == 200
    assert len(resp2.json()["problems"]) == count1


def test_patch_profile_regenerates_personalized_path(
    auth_client: TestClient, db: Session, persisted_user
):
    for i in range(6):
        db.add(
            Problem(
                title=f"Regen {i}",
                description="x" * 20,
                difficulty="easy" if i < 3 else "hard",
                language="python",
                source="curated",
                is_published=True,
                sort_order=i,
            )
        )
    db.commit()

    auth_client.patch(
        "/users/me",
        json={
            "coding_experience": "none",
            "learning_goal": "fun",
            "interested_topics": [],
        },
    )
    before = auth_client.get("/users/me/learning-path").json()["problems"]

    auth_client.patch(
        "/users/me",
        json={"coding_experience": "professional", "learning_goal": "job"},
    )
    after = auth_client.get("/users/me/learning-path").json()["problems"]

    assert len(before) >= 1
    assert len(after) >= 1
