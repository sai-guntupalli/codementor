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


def test_problems_meta(auth_client: TestClient, db):
    from models.learning import Problem

    db.add(
        Problem(
            title="Meta Easy",
            description="x" * 20,
            difficulty="easy",
            language="python",
            source="curated",
            is_published=True,
        )
    )
    db.commit()
    resp = auth_client.get("/problems/facets")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert "by_difficulty" in body
    assert "unsolved_count" in body


def test_search_problems_by_topic_partial(auth_client: TestClient, db):
    from models.learning import Problem

    db.add(
        Problem(
            title="Unique Partial Tag Problem",
            description="x" * 20,
            difficulty="easy",
            language="python",
            topic=["xyz-only-tag-abc"],
            source="curated",
            is_published=True,
        )
    )
    db.commit()
    by_topic = auth_client.get("/problems?topic=xyz-only")
    assert by_topic.status_code == 200
    body = by_topic.json()
    assert body["total"] >= 1
    assert any(i["title"] == "Unique Partial Tag Problem" for i in body["items"])

    by_q = auth_client.get("/problems?q=Unique+Partial+Tag")
    assert by_q.status_code == 200
    assert by_q.json()["total"] >= 1


def test_topic_filter_partial_match(auth_client: TestClient, db):
    from models.learning import Problem

    db.add(
        Problem(
            title="Loop Basics",
            description="x" * 20,
            difficulty="beginner",
            language="python",
            topic=["loops"],
            source="curated",
            is_published=True,
        )
    )
    db.commit()
    resp = auth_client.get("/problems?topic=loop")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_problems_tags_endpoint(auth_client: TestClient, db):
    from models.learning import Problem

    db.add(
        Problem(
            title="Tagged",
            description="x" * 20,
            difficulty="easy",
            language="python",
            topic=["strings"],
            source="curated",
            is_published=True,
        )
    )
    db.commit()
    resp = auth_client.get("/problems/topic-tags?q=str")
    assert resp.status_code == 200
    body = resp.json()
    assert "tags" in body
    assert "suggested" in body
    assert any("strings" in t["tag"] for t in body["tags"])


def test_search_problems_by_title(auth_client: TestClient, db):
    from models.learning import Problem

    db.add(
        Problem(
            title="Unique Zebra Search",
            description="x" * 20,
            difficulty="easy",
            language="python",
            source="curated",
            is_published=True,
        )
    )
    db.commit()
    resp = auth_client.get("/problems?q=Zebra")
    assert resp.status_code == 200
    titles = [i["title"] for i in resp.json()["items"]]
    assert any("Zebra" in t for t in titles)


def test_filter_by_language(auth_client: TestClient):
    """GET /problems?language=python returns only python problems (API-01)."""
    response = auth_client.get("/problems?language=python")
    assert response.status_code == 200
    body = response.json()
    for item in body["items"]:
        assert item["language"] == "python"


def test_reserved_paths_not_parsed_as_uuid(auth_client: TestClient):
    for path in ("/problems/meta", "/problems/tags", "/problems/facets", "/problems/topic-tags"):
        resp = auth_client.get(path)
        assert resp.status_code == 200, path


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
    from schemas.problem import ProblemOut, ProblemPublicOut

    public_fields = ProblemPublicOut.model_fields
    assert "slug" in public_fields
    assert "hints" not in public_fields

    admin_fields = ProblemOut.model_fields
    assert "hints" in admin_fields


def test_problem_solution_out_schema():
    from schemas.problem import ProblemSolutionOut
    fields = ProblemSolutionOut.model_fields
    assert "problem_id" in fields
    assert "variant" in fields
    assert "code" in fields
    assert "is_primary" in fields
    assert "time_complexity" in fields


def test_generate_solution_cached(auth_client, db):
    from models.learning import Problem, ProblemSolution

    problem = Problem(
        title="Cache Test", description="Test.", difficulty="easy",
        language="python", source="curated", is_published=True,
    )
    db.add(problem)
    db.flush()
    solution = ProblemSolution(
        problem_id=problem.id, language="python", variant="optimal",
        code="def solve(): return 42", is_primary=False,
    )
    db.add(solution)
    db.commit()

    resp = auth_client.post(
        f"/problems/{problem.id}/solutions/generate?variant=optimal",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["variant"] == "optimal"
    assert data["code"] == "def solve(): return 42"


def test_generate_solution_invalid_variant(auth_client, db):
    from models.learning import Problem

    problem = Problem(
        title="Variant Test", description="Test.", difficulty="easy",
        language="python", source="curated", is_published=True,
    )
    db.add(problem)
    db.commit()

    resp = auth_client.post(
        f"/problems/{problem.id}/solutions/generate?variant=invalid",
    )
    assert resp.status_code == 422


def test_generate_solution_problem_not_found(auth_client):
    import uuid
    resp = auth_client.post(
        f"/problems/{uuid.uuid4()}/solutions/generate?variant=optimal",
    )
    assert resp.status_code == 404
