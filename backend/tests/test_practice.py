"""Unit tests for practice LLM variable builders."""

import uuid

from llm.practice import (
    hint_variables,
    parse_surprise_problem_json,
    solution_variables,
    surprise_variables,
    teach_variables,
)
from models.learning import Problem
from models.users import User


def _problem() -> Problem:
    return Problem(
        id=uuid.uuid4(),
        title="Hello",
        description="Print hello",
        language="python",
        difficulty="easy",
        topic=["basics"],
        source="curated",
    )


def _user() -> User:
    return User(
        id=uuid.uuid4(),
        email="p@example.com",
        profile_level="student",
        skill_level={"python": 2},
    )


def test_hint_variables():
    p, u = _problem(), _user()
    v = hint_variables(p, u, "print('hi')", 2)
    assert v["hint_number"] == "2"
    assert "Hello" in v["problem"]
    assert "print" in v["code_so_far"]


def test_solution_variables():
    p, u = _problem(), _user()
    v = solution_variables(p, u, "beginner")
    assert v["solution_level"] == "beginner"
    assert v["language"] == "python"


def test_teach_variables():
    u = _user()
    v = teach_variables(u, "x = 1", "python", "eli5")
    assert v["explain_style"] == "eli5"
    assert "x = 1" in v["code"]


def test_surprise_variables():
    u = _user()
    v = surprise_variables(u, "python", "loops", [uuid.uuid4()])
    assert v["language"] == "python"
    assert "loops" in v["topic_focus"]


def test_parse_surprise_problem_json_from_fence():
    raw = 'Here is the problem:\n```json\n{"title": "T", "description": "D"}\n```'
    data = parse_surprise_problem_json(raw)
    assert data["title"] == "T"
