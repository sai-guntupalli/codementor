from models.learning import Problem
from models.users import User


def test_difficulties_for_none_includes_easy(db, persisted_user: User):
    from core.learning_path import difficulties_for_user, fetch_ranked_candidates

    persisted_user.coding_experience = "none"
    db.add(
        Problem(
            title="Easy One",
            description="x" * 20,
            difficulty="easy",
            language="python",
            source="curated",
            is_published=True,
        )
    )
    db.add(
        Problem(
            title="Hard One",
            description="x" * 20,
            difficulty="hard",
            language="python",
            source="curated",
            is_published=True,
        )
    )
    db.commit()

    diffs = difficulties_for_user(persisted_user)
    assert "easy" in diffs
    candidates = fetch_ranked_candidates(db, persisted_user, limit=500)
    titles = {p.title for p in candidates}
    assert "Hard One" not in titles
    assert all(p.difficulty in diffs for p in candidates)


def test_build_learning_path_sizes(db):
    import uuid

    from core.learning_path import NEXT_SIZE, PATH_SIZE, build_learning_path

    problems = [
        Problem(
            id=uuid.uuid4(),
            title=f"P{i}",
            description="d" * 20,
            difficulty="easy",
            language="python",
            source="curated",
        )
        for i in range(30)
    ]
    path, nxt = build_learning_path(problems)
    assert len(path) == PATH_SIZE
    assert len(nxt) == NEXT_SIZE
