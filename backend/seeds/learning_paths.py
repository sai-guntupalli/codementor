"""Seed curated learning paths — one track per major Python / DSA topic."""

from __future__ import annotations

import argparse

from sqlalchemy.orm import Session

from db.session import SessionLocal
from models.learning import LearningPath, LearningPathProblem, LearningPathType, Problem

# Pedagogical order: fundamentals → structures → algorithms
CURATED_PATHS: list[dict] = [
    {
        "title": "Python Basics",
        "description": "Variables, printing, and your first programs.",
        "sort_order": 1,
        "topic": "basics",
        "max_problems": 20,
        "difficulties": ["beginner", "easy"],
    },
    {
        "title": "Input & Output",
        "description": "Read from stdin, format output, and practice I/O patterns.",
        "sort_order": 2,
        "topic": "io",
        "max_problems": 18,
        "difficulties": ["beginner", "easy"],
    },
    {
        "title": "Strings",
        "description": "Manipulate text, parsing, and common string techniques.",
        "sort_order": 3,
        "topic": "strings",
        "max_problems": 20,
        "difficulties": ["beginner", "easy", "medium"],
    },
    {
        "title": "Conditionals",
        "description": "Branching logic with if/elif/else and boolean expressions.",
        "sort_order": 4,
        "topic": "conditionals",
        "max_problems": 15,
        "difficulties": ["beginner", "easy"],
    },
    {
        "title": "Loops",
        "description": "for and while loops, iteration, and loop patterns.",
        "sort_order": 5,
        "topic": "loops",
        "max_problems": 20,
        "difficulties": ["beginner", "easy", "medium"],
    },
    {
        "title": "Functions",
        "description": "Define reusable logic with parameters and return values.",
        "sort_order": 6,
        "topic": "functions",
        "max_problems": 20,
        "difficulties": ["easy", "medium"],
    },
    {
        "title": "Lists & Arrays",
        "description": "Work with sequences, indexing, and list algorithms.",
        "sort_order": 7,
        "topic": "arrays",
        "max_problems": 20,
        "difficulties": ["easy", "medium"],
    },
    {
        "title": "Math",
        "description": "Arithmetic, number theory, and mathematical problem solving.",
        "sort_order": 8,
        "topic": "math",
        "max_problems": 18,
        "difficulties": ["easy", "medium"],
    },
    {
        "title": "Dictionaries & Hash Maps",
        "description": "Key–value storage, counting, and lookup patterns.",
        "sort_order": 9,
        "topic": "hash-map",
        "max_problems": 18,
        "difficulties": ["easy", "medium", "hard"],
    },
    {
        "title": "Sets",
        "description": "Unique collections, membership, and set operations.",
        "sort_order": 10,
        "topic": "sets",
        "max_problems": 10,
        "difficulties": ["easy", "medium", "hard"],
    },
    {
        "title": "Simulation",
        "description": "Step-by-step simulation and implementation-heavy exercises.",
        "sort_order": 11,
        "topic": "simulation",
        "max_problems": 15,
        "difficulties": ["easy", "medium"],
    },
    {
        "title": "Recursion",
        "description": "Break problems down with recursive calls and base cases.",
        "sort_order": 12,
        "topic": "recursion",
        "max_problems": 15,
        "difficulties": ["easy", "medium", "hard"],
    },
    {
        "title": "Sorting",
        "description": "Classic sorting algorithms and ordering problems.",
        "sort_order": 13,
        "topic": "sorting",
        "max_problems": 12,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Searching",
        "description": "Linear search, bounds, and search-space reasoning.",
        "sort_order": 14,
        "topic": "searching",
        "max_problems": 12,
        "difficulties": ["easy", "medium", "hard"],
    },
    {
        "title": "Binary Search",
        "description": "Divide the search space on sorted data.",
        "sort_order": 15,
        "topic": "binary-search",
        "max_problems": 10,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Two Pointers",
        "description": "Move two indices through arrays and strings efficiently.",
        "sort_order": 16,
        "topic": "two-pointers",
        "max_problems": 12,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Stacks",
        "description": "LIFO structures, parsing, and monotonic stack patterns.",
        "sort_order": 17,
        "topic": "stack",
        "max_problems": 12,
        "difficulties": ["easy", "medium", "hard"],
    },
    {
        "title": "Queues",
        "description": "FIFO processing and breadth-first style thinking.",
        "sort_order": 18,
        "topic": "queue",
        "max_problems": 10,
        "difficulties": ["easy", "medium", "hard"],
    },
    {
        "title": "Linked Lists",
        "description": "Nodes, pointers, and list traversal patterns.",
        "sort_order": 19,
        "topic": "linked-list",
        "max_problems": 10,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Matrices",
        "description": "2D grids, traversal, and matrix manipulation.",
        "sort_order": 20,
        "topic": "matrix",
        "max_problems": 15,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Binary Trees",
        "description": "Tree traversal, BST properties, and recursive tree work.",
        "sort_order": 21,
        "topic": "binary-tree",
        "max_problems": 18,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Graphs",
        "description": "Nodes, edges, BFS/DFS, and graph modeling.",
        "sort_order": 22,
        "topic": "graph",
        "max_problems": 10,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Dynamic Programming",
        "description": "Memoization and optimal substructure.",
        "sort_order": 23,
        "topic": "dynamic-programming",
        "max_problems": 18,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Greedy Algorithms",
        "description": "Locally optimal choices that build global solutions.",
        "sort_order": 24,
        "topic": "greedy",
        "max_problems": 12,
        "difficulties": ["medium", "hard"],
    },
    {
        "title": "Backtracking",
        "description": "Explore choices, prune, and undo state.",
        "sort_order": 25,
        "topic": "backtracking",
        "max_problems": 10,
        "difficulties": ["medium", "hard"],
    },
]

LEGACY_CURATED_TITLES = frozenset({"Python Fundamentals", "Interview Prep 101"})

_DIFFICULTY_RANK = {"beginner": 0, "easy": 1, "medium": 2, "hard": 3}


def _problems_for_path(db: Session, spec: dict) -> list[Problem]:
    topic = spec["topic"]
    difficulties = spec.get("difficulties")
    max_problems = spec["max_problems"]

    q = db.query(Problem).filter(
        Problem.is_published.is_(True),
        Problem.topic.overlap([topic]),
    )
    if difficulties:
        q = q.filter(Problem.difficulty.in_(difficulties))

    candidates = q.all()

    def sort_key(p: Problem) -> tuple:
        tags = p.topic or []
        primary = tags[0] == topic if tags else False
        return (
            0 if primary else 1,
            _DIFFICULTY_RANK.get(p.difficulty, 9),
            p.sort_order is None,
            p.sort_order if p.sort_order is not None else 999_999,
            p.title.lower(),
        )

    candidates.sort(key=sort_key)
    return candidates[:max_problems]


def _attach_problems(db: Session, path: LearningPath, spec: dict) -> int:
    db.query(LearningPathProblem).filter(
        LearningPathProblem.learning_path_id == path.id
    ).delete()
    problems = _problems_for_path(db, spec)
    for problem in problems:
        db.add(LearningPathProblem(learning_path_id=path.id, problem_id=problem.id))
    return len(problems)


def seed_learning_paths(*, sync: bool = False) -> None:
    """Create or update curated paths from CURATED_PATHS."""
    db = SessionLocal()
    created = 0
    updated = 0
    try:
        if sync:
            known = {s["title"] for s in CURATED_PATHS}
            for path in db.query(LearningPath).filter(
                LearningPath.type == LearningPathType.curated
            ):
                if path.title not in known:
                    db.query(LearningPathProblem).filter(
                        LearningPathProblem.learning_path_id == path.id
                    ).delete()
                    db.delete(path)

        for spec in CURATED_PATHS:
            path = (
                db.query(LearningPath)
                .filter(
                    LearningPath.type == LearningPathType.curated,
                    LearningPath.title == spec["title"],
                )
                .first()
            )
            if not path:
                path = LearningPath(
                    title=spec["title"],
                    description=spec["description"],
                    type=LearningPathType.curated,
                    created_by=None,
                    is_public=True,
                    sort_order=spec["sort_order"],
                )
                db.add(path)
                db.flush()
                count = _attach_problems(db, path, spec)
                created += 1
                print(f"  + {spec['title']} ({count} problems)")
                continue

            path.description = spec["description"]
            path.sort_order = spec["sort_order"]
            path.is_public = True

            existing_count = (
                db.query(LearningPathProblem)
                .filter(LearningPathProblem.learning_path_id == path.id)
                .count()
            )
            if sync or existing_count == 0:
                count = _attach_problems(db, path, spec)
                updated += 1
                print(f"  ↻ {spec['title']} ({count} problems)")
            else:
                print(f"  = {spec['title']} ({existing_count} problems, unchanged)")

        db.commit()
        print(
            f"Done: {created} created, {updated} refreshed, "
            f"{len(CURATED_PATHS)} curated paths defined"
        )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed curated learning paths")
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Remove legacy paths and refresh problem lists for all curated paths",
    )
    args = parser.parse_args()
    seed_learning_paths(sync=args.sync)


if __name__ == "__main__":
    main()
