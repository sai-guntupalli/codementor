"""Tests for AUTH-01, AUTH-02, AUTH-03, AUTH-04."""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.skip(reason="stub — AUTH-01: signup endpoint not yet implemented")
def test_signup(client: TestClient):
    """POST /auth/signup creates Supabase user + local DB row."""
    pass


@pytest.mark.skip(reason="stub — AUTH-02: login endpoint not yet implemented")
def test_login(client: TestClient):
    """POST /auth/login returns access_token and refresh_token."""
    pass


@pytest.mark.skip(reason="stub — AUTH-03: logout endpoint not yet implemented")
def test_logout(client: TestClient):
    """POST /auth/logout — session cleared, subsequent protected call returns 401."""
    pass


def test_protected_without_token(client: TestClient):
    """GET /users/me without Authorization header returns 401 (AUTH-04)."""
    response = client.get("/users/me")
    assert response.status_code == 401
