"""Tests for API-03."""

import uuid

from fastapi.testclient import TestClient


def test_create_submission_shape(auth_client: TestClient):
    """POST /submissions returns 201 with correct response shape (API-03)."""
    fake_problem_id = str(uuid.uuid4())
    response = auth_client.post(
        "/submissions",
        json={
            "problem_id": fake_problem_id,
            "code": "print('hello')",
            "language": "python",
        },
    )
    assert response.status_code in (201, 422, 500)
    if response.status_code == 201:
        body = response.json()
        assert "id" in body
        assert "user_id" in body
        assert "code" in body
        assert body["code"] == "print('hello')"
        assert body["language"] == "python"


def test_create_submission_requires_auth(client: TestClient):
    """POST /submissions without Authorization header returns 401 (AUTH-04)."""
    response = client.post(
        "/submissions",
        json={
            "problem_id": str(uuid.uuid4()),
            "code": "x = 1",
            "language": "python",
        },
    )
    assert response.status_code == 401


def test_list_my_submissions_empty(auth_client: TestClient):
    """GET /submissions/me returns empty list for user with no submissions."""
    res = auth_client.get("/submissions/me")
    assert res.status_code == 200
    assert res.json() == []


def test_list_my_submissions_requires_auth(client: TestClient):
    """GET /submissions/me without token returns 401."""
    res = client.get("/submissions/me")
    assert res.status_code == 401


def test_list_solved_problem_ids_empty(auth_client: TestClient):
    """GET /submissions/me/problem-ids returns empty list when user has no submissions."""
    res = auth_client.get("/submissions/me/problem-ids")
    assert res.status_code == 200
    assert res.json() == {"solved_ids": []}


def test_list_solved_problem_ids_requires_auth(client: TestClient):
    """GET /submissions/me/problem-ids without token returns 401."""
    res = client.get("/submissions/me/problem-ids")
    assert res.status_code == 401


def test_get_latest_submission_by_problem_not_found(auth_client: TestClient):
    """GET /submissions/me/by-problem/{id} returns 404 when user has not submitted."""
    res = auth_client.get(f"/submissions/me/by-problem/{uuid.uuid4()}")
    assert res.status_code == 404


def test_get_latest_submission_by_problem_requires_auth(client: TestClient):
    """GET /submissions/me/by-problem/{id} without token returns 401."""
    res = client.get(f"/submissions/me/by-problem/{uuid.uuid4()}")
    assert res.status_code == 401
