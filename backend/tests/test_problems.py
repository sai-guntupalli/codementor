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


def test_problem_has_new_fields():
    from models.learning import Problem

    assert hasattr(Problem, "slug")
    assert hasattr(Problem, "external_id")
    assert hasattr(Problem, "source_url")
    assert hasattr(Problem, "hints")


def test_problem_solution_model_exists():
    from models.learning import ProblemSolution

    assert hasattr(ProblemSolution, "problem_id")
    assert hasattr(ProblemSolution, "variant")
    assert hasattr(ProblemSolution, "code")
    assert hasattr(ProblemSolution, "is_primary")
    assert hasattr(ProblemSolution, "time_complexity")
    assert hasattr(ProblemSolution, "space_complexity")
    assert hasattr(ProblemSolution, "explanation")


def test_problem_out_has_new_fields():
    from schemas.problem import ProblemOut
    fields = ProblemOut.model_fields
    assert "slug" in fields
    assert "external_id" in fields
    assert "source_url" in fields
    assert "hints" in fields


def test_problem_solution_out_schema():
    from schemas.problem import ProblemSolutionOut
    fields = ProblemSolutionOut.model_fields
    assert "problem_id" in fields
    assert "variant" in fields
    assert "code" in fields
    assert "is_primary" in fields
    assert "time_complexity" in fields


def test_seed_problems_dataset_inserts_records(db):
    from seeds.problems_dataset import _insert_problem_with_solution

    item = {
        "external_id": 99999,
        "title": "Test Problem",
        "slug": "test-problem",
        "description": "Given a number, return it.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["math"],
        "examples": [{"input": "1", "output": "1", "explanation": ""}],
        "constraints": None,
        "hints": None,
        "source_url": "https://example.com/99999",
        "source": "imported",
        "solution_code": "class Solution:\n    def solve(self, n): return n",
        "time_complexity": "O(1)",
        "space_complexity": "O(1)",
    }

    _insert_problem_with_solution(db, item)
    db.commit()

    from models.learning import Problem, ProblemSolution
    problem = db.query(Problem).filter(Problem.external_id == 99999).first()
    assert problem is not None
    assert problem.title == "Test Problem"
    assert problem.topic == ["math"]

    solution = db.query(ProblemSolution).filter(ProblemSolution.problem_id == problem.id).first()
    assert solution is not None
    assert solution.variant == "original"
    assert solution.is_primary is True
    assert solution.time_complexity == "O(1)"


def test_seed_skips_duplicates(db):
    from seeds.problems_dataset import _insert_problem_with_solution

    item = {
        "external_id": 88888,
        "title": "Duplicate Problem",
        "slug": "duplicate-problem",
        "description": "Test description.",
        "difficulty": "easy",
        "language": "python",
        "topic": [],
        "examples": [],
        "constraints": None,
        "hints": None,
        "source_url": None,
        "source": "imported",
        "solution_code": "pass",
        "time_complexity": None,
        "space_complexity": None,
    }

    _insert_problem_with_solution(db, item)
    db.commit()

    inserted = _insert_problem_with_solution(db, item)
    assert inserted is False
