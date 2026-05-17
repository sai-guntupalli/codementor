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
