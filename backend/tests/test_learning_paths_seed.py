"""Tests for curated learning path seed definitions."""

from seeds.learning_paths import CURATED_PATHS, _problems_for_path


def test_curated_paths_cover_major_topics():
    topics = {s["topic"] for s in CURATED_PATHS}
    expected = {
        "basics",
        "io",
        "strings",
        "conditionals",
        "loops",
        "functions",
        "arrays",
        "math",
        "hash-map",
        "recursion",
        "sorting",
        "searching",
        "binary-search",
        "dynamic-programming",
        "binary-tree",
        "graph",
    }
    assert expected.issubset(topics)


def test_curated_paths_unique_titles_and_sort_order():
    titles = [s["title"] for s in CURATED_PATHS]
    assert len(titles) == len(set(titles))
    orders = [s["sort_order"] for s in CURATED_PATHS]
    assert len(orders) == len(set(orders))


def test_problems_for_path_returns_published(db):
    spec = next(s for s in CURATED_PATHS if s["topic"] == "strings")
    problems = _problems_for_path(db, spec)
    assert len(problems) >= 1
    assert all(p.is_published for p in problems)
    assert all("strings" in (p.topic or []) for p in problems)


def test_problems_for_path_balances_difficulties(db):
    """Paths with multiple difficulties must not fill entirely from the easiest tier."""
    spec = next(s for s in CURATED_PATHS if s["title"] == "Lists & Arrays")
    problems = _problems_for_path(db, spec)
    assert len(problems) <= spec["max_problems"]
    diffs = {p.difficulty for p in problems}
    assert "easy" in diffs
    assert "medium" in diffs, (
        f"expected easy+medium mix, got only {diffs} — "
        "check _balanced_by_difficulty when many easy problems exist"
    )
