"""Tests for GET /dashboard/me."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.test_learning_paths import _add_problem_to_path, _make_curated_path, _make_problem


def test_dashboard_requires_auth(client: TestClient):
    assert client.get("/dashboard/me").status_code == 401


def test_dashboard_returns_bundled_payload(auth_client: TestClient, db: Session):
    problem = _make_problem(db)
    path = _make_curated_path(db, title="Dashboard Path")
    _add_problem_to_path(db, path.id, problem.id)

    resp = auth_client.get("/dashboard/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "user" in data
    assert isinstance(data["learning_paths"], list)
    assert data["library_total"] >= 1
    assert data["solved_count"] == 0
    assert isinstance(data["recent_submissions"], list)
    assert isinstance(data["active_path_problems"], list)
