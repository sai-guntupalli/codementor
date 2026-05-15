import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db.session import SessionLocal
from main import app


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
