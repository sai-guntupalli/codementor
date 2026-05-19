import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import SessionLocal, engine, get_db
from main import app
from models.users import User


@pytest.fixture
def db() -> Session:
    """
    Wraps every test in a transaction that is always rolled back.
    Prevents test data from leaking into the real database.
    Also overrides the app's get_db so HTTP handlers share the same session.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client(db: Session) -> TestClient:
    return TestClient(app)


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
