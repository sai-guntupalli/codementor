"""Tests for API-06, API-07."""

import uuid

from fastapi.testclient import TestClient


def test_list_paths(auth_client: TestClient):
    """GET /curriculum-paths returns a list (API-06)."""
    response = auth_client.get("/curriculum-paths")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)


def test_get_path_not_found(auth_client: TestClient):
    """GET /curriculum-paths/{id} with unknown UUID returns 404 (API-07)."""
    fake_id = str(uuid.uuid4())
    response = auth_client.get(f"/curriculum-paths/{fake_id}")
    assert response.status_code == 404


def test_curriculum_requires_auth(client: TestClient):
    """GET /curriculum-paths without Authorization header returns 401 (AUTH-04)."""
    response = client.get("/curriculum-paths")
    assert response.status_code == 401
