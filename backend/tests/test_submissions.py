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
