"""One-off backfill: strip curriculum number prefixes from all problem titles in DB."""

from core.problem_titles import strip_curriculum_prefix
from db.session import SessionLocal
from models.learning import Problem


def strip_all_problem_titles() -> int:
    db = SessionLocal()
    updated = 0
    try:
        for problem in db.query(Problem).all():
            cleaned = strip_curriculum_prefix(problem.title)
            if cleaned != problem.title:
                problem.title = cleaned
                updated += 1
        db.commit()
        return updated
    finally:
        db.close()


if __name__ == "__main__":
    count = strip_all_problem_titles()
    print(f"Updated {count} problem title(s).")
