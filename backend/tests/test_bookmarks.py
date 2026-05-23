"""Tests for bookmarks endpoints."""
import uuid
from fastapi.testclient import TestClient
from models.learning import Problem


def _make_problem(db) -> Problem:
    p = Problem(
        title="Bookmark Test Problem",
        description="x" * 20,
        difficulty="easy",
        language="python",
        source="curated",
        is_published=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def test_add_bookmark(auth_client: TestClient, db):
    p = _make_problem(db)
    resp = auth_client.post(f"/bookmarks/{p.id}")
    assert resp.status_code == 201
    body = resp.json()
    assert body["problem_id"] == str(p.id)


def test_add_bookmark_idempotent(auth_client: TestClient, db):
    p = _make_problem(db)
    auth_client.post(f"/bookmarks/{p.id}")
    resp = auth_client.post(f"/bookmarks/{p.id}")
    assert resp.status_code == 201  # idempotent


def test_list_bookmarks(auth_client: TestClient, db):
    p = _make_problem(db)
    auth_client.post(f"/bookmarks/{p.id}")
    resp = auth_client.get("/bookmarks")
    assert resp.status_code == 200
    ids = [item["problem_id"] for item in resp.json()]
    assert str(p.id) in ids


def test_list_bookmarked_ids(auth_client: TestClient, db):
    p = _make_problem(db)
    auth_client.post(f"/bookmarks/{p.id}")
    resp = auth_client.get("/bookmarks/ids")
    assert resp.status_code == 200
    assert str(p.id) in resp.json()


def test_remove_bookmark(auth_client: TestClient, db):
    p = _make_problem(db)
    auth_client.post(f"/bookmarks/{p.id}")
    resp = auth_client.delete(f"/bookmarks/{p.id}")
    assert resp.status_code == 204
    ids = auth_client.get("/bookmarks/ids").json()
    assert str(p.id) not in ids


def test_remove_nonexistent_bookmark(auth_client: TestClient):
    resp = auth_client.delete(f"/bookmarks/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_bookmark_nonexistent_problem(auth_client: TestClient):
    resp = auth_client.post(f"/bookmarks/{uuid.uuid4()}")
    assert resp.status_code == 404
