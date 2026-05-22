"""Topic tag helpers for problem browse filters."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

# Canonical tags used by enrichment; shown in UI as suggestions.
CANONICAL_TAGS: tuple[str, ...] = (
    "strings",
    "arrays",
    "math",
    "conditionals",
    "loops",
    "functions",
    "recursion",
    "sorting",
    "searching",
    "hash-map",
    "sets",
    "linked-list",
    "binary-tree",
    "graph",
    "dynamic-programming",
    "two-pointers",
    "binary-search",
    "stack",
    "queue",
    "matrix",
    "simulation",
    "greedy",
    "backtracking",
    "io",
    "basics",
)


def normalize_topic_query(raw: str) -> str:
    return raw.strip().lower().replace(" ", "-").replace("_", "-")


def topic_like_pattern(raw: str) -> str:
    """SQL LIKE pattern for partial tag match."""
    normalized = normalize_topic_query(raw)
    if not normalized:
        return "%"
    return f"%{normalized}%"


def topic_array_match_clause() -> text:
    """Match if any topic tag contains the needle (case-insensitive)."""
    return text(
        "EXISTS (SELECT 1 FROM unnest(topic) AS tag "
        "WHERE lower(tag) LIKE :topic_needle)"
    )


def fetch_tag_counts(
    db: Session,
    *,
    language: str | None = None,
    difficulty: str | None = None,
    q: str | None = None,
    limit: int = 40,
) -> list[tuple[str, int]]:
    """Return (tag, problem_count) sorted by popularity."""
    clauses = ["p.is_published IS TRUE", "p.topic IS NOT NULL"]
    params: dict = {"limit": limit}

    if language:
        clauses.append("p.language = :language")
        params["language"] = language
    if difficulty:
        clauses.append("p.difficulty = :difficulty")
        params["difficulty"] = difficulty
    if q and q.strip():
        clauses.append("lower(t.tag) LIKE :tag_q")
        params["tag_q"] = topic_like_pattern(q)

    where = " AND ".join(clauses)
    sql = text(
        f"""
        SELECT t.tag, COUNT(DISTINCT p.id)::int AS cnt
        FROM problems p
        CROSS JOIN LATERAL unnest(p.topic) AS t(tag)
        WHERE {where}
        GROUP BY t.tag
        ORDER BY cnt DESC, t.tag ASC
        LIMIT :limit
        """
    )
    rows = db.execute(sql, params).fetchall()
    return [(str(row[0]), int(row[1])) for row in rows]
