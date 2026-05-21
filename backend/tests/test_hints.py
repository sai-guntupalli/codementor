"""Tests for stored hints (problems.hints JSONB)."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from llm.hints import parse_hints_response
from llm.practice import get_stored_hint, normalize_hints
from models.learning import Problem


def test_normalize_hints_filters_empty():
    assert normalize_hints(["a", "", "  ", "b", "c", "d"]) == ["a", "b", "c"]


def test_get_stored_hint_one_based():
    p = Problem(
        title="T",
        description="D",
        difficulty="easy",
        language="python",
        source="curated",
        hints=["first", "second", "third"],
    )
    assert get_stored_hint(p, 1) == "first"
    assert get_stored_hint(p, 3) == "third"
    assert get_stored_hint(p, 4) is None


def test_get_problem_excludes_hints(auth_client: TestClient, db):
    problem = Problem(
        title="Secret Hints",
        description="Do work.",
        difficulty="easy",
        language="python",
        source="curated",
        is_published=True,
        hints=["h1", "h2", "h3"],
    )
    db.add(problem)
    db.commit()

    res = auth_client.get(f"/problems/{problem.id}")
    assert res.status_code == 200
    body = res.json()
    assert "hints" not in body


def test_request_hint_returns_stored(auth_client: TestClient, db):
    problem = Problem(
        title="Multiply",
        description="Multiply two numbers.",
        difficulty="beginner",
        language="python",
        source="curated",
        is_published=True,
        hints=[
            "Read both integers from input.",
            "Use the * operator on the two values.",
            "Print the product with print().",
        ],
    )
    db.add(problem)
    db.commit()

    res = auth_client.post(
        f"/problems/{problem.id}/hint",
        json={"code": "", "hint_number": 2},
    )
    assert res.status_code == 200
    tokens: list[str] = []
    for line in res.iter_lines():
        if not line.startswith("data: "):
            continue
        payload = json.loads(line[6:])
        if "token" in payload:
            tokens.append(payload["token"])
        if payload.get("type") == "done":
            assert payload.get("source") == "stored"
            assert payload.get("cost_usd") == 0.0
    assert "".join(tokens) == problem.hints[1]


@pytest.mark.anyio
async def test_ensure_problem_hints_generates_once(db):
    from models.users import User
    from llm.hints import ensure_problem_hints

    user = User(email="h@example.com", profile_level="student")
    db.add(user)
    problem = Problem(
        title="Lazy",
        description="Add numbers.",
        difficulty="easy",
        language="python",
        source="curated",
        is_published=True,
        hints=None,
    )
    db.add(problem)
    db.commit()

    fake_hints = ["h1", "h2", "h3"]
    with patch(
        "llm.hints.generate_hints_for_problem",
        new_callable=AsyncMock,
        return_value=fake_hints,
    ) as mock_gen:
        result = await ensure_problem_hints(db, problem, user)
        assert result.hints == fake_hints
        mock_gen.assert_called_once()

        # Second call should not regenerate
        await ensure_problem_hints(db, result, user)
        mock_gen.assert_called_once()


def test_parse_hints_response():
    raw = '{"hints": ["a", "b", "c"]}'
    assert parse_hints_response(raw) == ["a", "b", "c"]


def test_request_hint_lazy_generates(auth_client: TestClient, db):
    problem = Problem(
        title="No Hints Yet",
        description="Test.",
        difficulty="easy",
        language="python",
        source="curated",
        is_published=True,
        hints=None,
    )
    db.add(problem)
    db.commit()

    fake_hints = ["first hint", "second hint", "third hint"]

    with patch(
        "api.practice.ensure_problem_hints",
        new_callable=AsyncMock,
        side_effect=lambda db, p, u: _set_hints(db, p, fake_hints),
    ):
        res = auth_client.post(
            f"/problems/{problem.id}/hint",
            json={"code": "x=1", "hint_number": 1},
        )

    assert res.status_code == 200
    tokens: list[str] = []
    for line in res.iter_lines():
        if line.startswith("data: "):
            payload = json.loads(line[6:])
            if "token" in payload:
                tokens.append(payload["token"])
    assert "".join(tokens) == "first hint"


def _set_hints(db, problem, hints):
    problem.hints = hints
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem


def test_problem_public_out_has_no_hints_field():
    from schemas.problem import ProblemPublicOut

    assert "hints" not in ProblemPublicOut.model_fields
