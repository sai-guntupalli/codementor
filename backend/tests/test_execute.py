"""Tests for POST /execute."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


def test_execute_requires_auth(client: TestClient):
    """Unauthenticated request returns 401."""
    res = client.post("/execute", json={"language": "python", "code": "print(1)"})
    assert res.status_code == 401


def test_execute_sql_not_supported(auth_client: TestClient):
    """SQL language returns 422 unsupported."""
    res = auth_client.post("/execute", json={"language": "sql", "code": "SELECT 1"})
    assert res.status_code == 422
    assert "not supported" in res.json()["detail"].lower()


def test_execute_code_too_large(auth_client: TestClient):
    """Code exceeding 32 000 chars is rejected by schema validation."""
    res = auth_client.post(
        "/execute", json={"language": "python", "code": "x" * 33_000}
    )
    assert res.status_code == 422


def test_execute_normalizes_stdin_for_piston(auth_client: TestClient):
    """Literal \\n in stdin is expanded before calling Piston."""
    mock_response = {
        "run": {"stdout": "20\n", "stderr": "", "code": 0, "signal": None}
    }
    captured: dict = {}

    async def fake_post(*_args, **kwargs):
        captured["json"] = kwargs.get("json")
        return AsyncMock(
            status_code=200,
            json=lambda: mock_response,
            raise_for_status=lambda: None,
        )

    with patch(
        "api.execute.httpx.AsyncClient.post",
        new=AsyncMock(side_effect=fake_post),
    ):
        res = auth_client.post(
            "/execute",
            json={
                "language": "python",
                "code": "a=int(input())\nb=int(input())\nprint(a*b)",
                "stdin": "4\\n5",
            },
        )
    assert res.status_code == 200
    assert captured["json"]["stdin"] == "4\n5\n"
    assert captured["json"]["files"][0]["name"] == "main.py"
    assert captured["json"]["run_timeout"] == 3000
    assert captured["json"]["compile_timeout"] == 3000


def test_execute_python_success(auth_client: TestClient):
    """Happy path: valid Python returns stdout."""
    mock_response = {
        "run": {"stdout": "hello\n", "stderr": "", "code": 0, "signal": None}
    }
    with patch(
        "api.execute.httpx.AsyncClient.post",
        new=AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_response,
            raise_for_status=lambda: None,
        )),
    ):
        res = auth_client.post(
            "/execute", json={"language": "python", "code": "print('hello')"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["stdout"] == "hello\n"
    assert data["stderr"] == ""
    assert data["exit_code"] == 0
    assert data["timed_out"] is False


def test_execute_piston_timeout(auth_client: TestClient):
    """Piston timeout returns timed_out=True, no crash."""
    import httpx

    with patch(
        "api.execute.httpx.AsyncClient.post",
        new=AsyncMock(side_effect=httpx.TimeoutException("timed out")),
    ):
        res = auth_client.post(
            "/execute", json={"language": "python", "code": "import time; time.sleep(99)"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["timed_out"] is True
    assert data["stdout"] == ""
