"""Seed script: insert enriched problems and their original solutions into the DB."""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from db.session import SessionLocal
from models.learning import Problem, ProblemSolution

ENRICHED = Path("seeds/data/enriched_problems.json")


def _insert_problem_with_solution(db: Session, item: dict) -> bool:
    """Insert one problem + original solution. Returns False if already exists."""
    existing = (
        db.query(Problem)
        .filter(Problem.external_id == item["external_id"], Problem.language == item["language"])
        .first()
    )
    if existing:
        return False

    problem = Problem(
        title=item["title"],
        slug=item.get("slug"),
        description=item.get("description") or item["title"],
        difficulty=item["difficulty"],
        language=item["language"],
        topic=item.get("topic") or [],
        examples=item.get("examples") or [],
        constraints=item.get("constraints"),
        hints=item.get("hints"),
        external_id=item.get("external_id"),
        source_url=item.get("source_url"),
        source=item.get("source", "imported"),
        is_published=True,
    )
    db.add(problem)
    db.flush()

    if item.get("solution_code"):
        solution = ProblemSolution(
            problem_id=problem.id,
            language=item["language"],
            variant="original",
            code=item["solution_code"],
            time_complexity=item.get("time_complexity"),
            space_complexity=item.get("space_complexity"),
            explanation=None,
            is_primary=True,
        )
        db.add(solution)

    return True


def seed_problems_dataset() -> None:
    if not ENRICHED.exists():
        print(f"ERROR: {ENRICHED} not found. Run 'python -m seeds.scraper' then 'python -m seeds.enrich' first.")
        return

    data = json.loads(ENRICHED.read_text())
    db = SessionLocal()
    try:
        inserted = skipped = 0
        for item in data:
            result = _insert_problem_with_solution(db, item)
            if result:
                inserted += 1
            else:
                skipped += 1
        db.commit()
        print(f"Done: {inserted} inserted, {skipped} skipped.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_problems_dataset()
