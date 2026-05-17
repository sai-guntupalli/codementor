import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import SessionLocal
from main import app
from models.users import User


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db() -> Session:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user() -> User:
    """In-memory User template (may be merged into DB by persisted_user)."""
    user_id = uuid.uuid4()
    return User(
        id=user_id,
        email=f"test-{user_id}@example.com",
        display_name=None,
        profile_level="student",
        skill_level={},
        streak_days=0,
        xp_total=0,
    )


@pytest.fixture
def persisted_user(db: Session, test_user: User) -> User:
    """test_user merged into the database for write-path tests."""
    user = db.merge(test_user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_client(client: TestClient, persisted_user: User) -> TestClient:
    """TestClient with get_current_user overridden to return persisted_user."""

    def override_get_current_user() -> User:
        return persisted_user

    app.dependency_overrides[get_current_user] = override_get_current_user
    yield client
    app.dependency_overrides.pop(get_current_user, None)
