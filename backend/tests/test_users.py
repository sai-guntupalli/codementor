"""Tests for AUTH-05, API-04, API-05."""

import uuid

from fastapi.testclient import TestClient

from models.users import User


def test_profile_incomplete_flag(test_user: User):
    """AUTH-05: UserOut.is_profile_complete is False when display_name is None."""
    from schemas.user import UserOut

    out = UserOut.model_validate(test_user)
    assert out.is_profile_complete is False


def test_profile_complete_flag():
    """AUTH-05: UserOut.is_profile_complete is True when display_name is set."""
    from schemas.user import UserOut

    user = User(
        id=uuid.uuid4(),
        email="x@x.com",
        display_name="Alice",
        profile_level="engineer",
        skill_level={},
        streak_days=0,
        xp_total=0,
    )
    out = UserOut.model_validate(user)
    assert out.is_profile_complete is True


def test_get_me(auth_client: TestClient):
    """GET /users/me returns current user profile (API-04)."""
    response = auth_client.get("/users/me")
    assert response.status_code == 200
    body = response.json()
    assert "id" in body
    assert "email" in body
    assert "is_profile_complete" in body
    assert body["is_profile_complete"] is False


def test_update_me_display_name(auth_client: TestClient):
    """PATCH /users/me with display_name updates and returns updated profile (API-05)."""
    response = auth_client.patch("/users/me", json={"display_name": "Alice"})
    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Alice"
    assert body["is_profile_complete"] is True


def test_update_me_profile_level(auth_client: TestClient):
    """PATCH /users/me with profile_level updates correctly (API-05)."""
    response = auth_client.patch("/users/me", json={"profile_level": "engineer"})
    assert response.status_code == 200
    assert response.json()["profile_level"] == "engineer"


def test_users_me_requires_auth(client: TestClient):
    """GET /users/me without Authorization header returns 401 (AUTH-04)."""
    response = client.get("/users/me")
    assert response.status_code == 401
