"""Tests for API-01, API-02."""

import uuid

from fastapi.testclient import TestClient


def test_list_problems(auth_client: TestClient):
    """GET /problems returns paginated response with required keys (API-01)."""
    response = auth_client.get("/problems")
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body
    assert "page" in body
    assert "page_size" in body
    assert isinstance(body["items"], list)
    assert body["page"] == 1


def test_filter_by_language(auth_client: TestClient):
    """GET /problems?language=python returns only python problems (API-01)."""
    response = auth_client.get("/problems?language=python")
    assert response.status_code == 200
    body = response.json()
    for item in body["items"]:
        assert item["language"] == "python"


def test_get_problem_not_found(auth_client: TestClient):
    """GET /problems/{id} with unknown UUID returns 404 (API-02)."""
    fake_id = str(uuid.uuid4())
    response = auth_client.get(f"/problems/{fake_id}")
    assert response.status_code == 404


def test_problems_requires_auth(client: TestClient):
    """GET /problems without Authorization header returns 401 (AUTH-04)."""
    response = client.get("/problems")
    assert response.status_code == 401
