"""Ingest Garvit244/Leetcode problems into the database with dedup and solutions.

Usage:
    cd backend && uv run python -m seeds.ingest_leetcode          # scrape + insert
    cd backend && uv run python -m seeds.ingest_leetcode --scrape-only
    cd backend && uv run python -m seeds.ingest_leetcode --insert-only
"""

from __future__ import annotations

import argparse
import json
import sys
from difflib import SequenceMatcher
from pathlib import Path

from seeds.scrapers.garvit_leetcode import scrape_all

DATA_DIR = Path(__file__).parent / "data"
RAW_FILE = DATA_DIR / "garvit_leetcode.json"
DEDUP_RATIO = 0.82


def _fuzzy_match(a: str, b: str) -> bool:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() > DEDUP_RATIO


def dedup_batch(problems: list[dict]) -> list[dict]:
    """Remove duplicates within the scraped batch."""
    seen_ids: set[int] = set()
    seen_slugs: set[str] = set()
    seen_titles: list[str] = []
    out: list[dict] = []

    for p in problems:
        ext_id = p.get("external_id")
        slug = p.get("slug") or ""
        title = p.get("title") or ""

        if ext_id is not None and ext_id in seen_ids:
            continue
        if slug and slug in seen_slugs:
            continue
        if any(_fuzzy_match(title, t) for t in seen_titles):
            continue

        if ext_id is not None:
            seen_ids.add(ext_id)
        if slug:
            seen_slugs.add(slug)
        seen_titles.append(title)
        out.append(p)

    return out


def load_db_baseline() -> tuple[set[int], set[str], list[str]]:
    from db.session import SessionLocal
    from models.learning import Problem

    db = SessionLocal()
    try:
        rows = db.query(Problem.external_id, Problem.slug, Problem.title).filter(
            Problem.language == "python"
        ).all()
        ext_ids = {r[0] for r in rows if r[0] is not None}
        slugs = {r[1] for r in rows if r[1]}
        titles = [r[2] for r in rows if r[2]]
        return ext_ids, slugs, titles
    finally:
        db.close()


def dedup_against_db(
    problems: list[dict],
    existing_ext_ids: set[int],
    existing_slugs: set[str],
    existing_titles: list[str],
) -> tuple[list[dict], int]:
    """Filter out problems already in the database."""
    out: list[dict] = []
    skipped = 0

    for p in problems:
        ext_id = p.get("external_id")
        slug = p.get("slug") or ""
        title = p.get("title") or ""

        if ext_id is not None and ext_id in existing_ext_ids:
            skipped += 1
            continue
        if slug and slug in existing_slugs:
            skipped += 1
            continue
        if any(_fuzzy_match(title, t) for t in existing_titles):
            skipped += 1
            continue

        out.append(p)

    return out, skipped


def insert_problems(problems: list[dict]) -> tuple[int, int]:
    from db.session import SessionLocal
    from models.learning import Problem, ProblemSolution

    db = SessionLocal()
    inserted = 0
    skipped = 0

    try:
        existing_ext_ids, existing_slugs, existing_titles = load_db_baseline()
        to_insert, pre_skipped = dedup_against_db(
            problems, existing_ext_ids, existing_slugs, existing_titles
        )
        skipped += pre_skipped

        for item in to_insert:
            ext_id = item.get("external_id")
            slug = item.get("slug")

            dup = (
                db.query(Problem)
                .filter(
                    Problem.language == "python",
                    Problem.external_id == ext_id,
                )
                .first()
            )
            if dup:
                skipped += 1
                continue

            if slug:
                dup_slug = db.query(Problem).filter(Problem.slug == slug).first()
                if dup_slug:
                    skipped += 1
                    continue

            problem = Problem(
                title=item["title"],
                slug=slug,
                description=item["description"],
                difficulty=item["difficulty"],
                language="python",
                topic=item.get("topic") or [],
                examples=item.get("examples") or [],
                constraints=item.get("constraints"),
                external_id=ext_id,
                source_url=item.get("source_url"),
                source="imported",
                is_published=True,
                sort_order=item.get("sort_order"),
            )
            db.add(problem)
            db.flush()

            code = (item.get("solution_code") or "").strip()
            if code:
                db.add(
                    ProblemSolution(
                        problem_id=problem.id,
                        language="python",
                        variant="original",
                        code=code,
                        time_complexity=item.get("time_complexity"),
                        space_complexity=item.get("space_complexity"),
                        is_primary=True,
                    )
                )

            if ext_id is not None:
                existing_ext_ids.add(ext_id)
            if slug:
                existing_slugs.add(slug)
            existing_titles.append(item["title"])
            inserted += 1

        db.commit()
        return inserted, skipped
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def run_scrape() -> list[dict]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    def progress(msg: str) -> None:
        print(msg, flush=True)

    print("Scraping Garvit244/Leetcode...")
    raw = scrape_all(on_progress=progress)
    print(f"Fetched {len(raw)} problems with solutions")

    deduped = dedup_batch(raw)
    print(f"After in-batch dedup: {len(deduped)} ({len(raw) - len(deduped)} removed)")

    RAW_FILE.write_text(json.dumps(deduped, indent=2, ensure_ascii=False))
    print(f"Wrote {RAW_FILE}")
    return deduped


def run_insert() -> None:
    if not RAW_FILE.exists():
        print(f"Missing {RAW_FILE}. Run scrape first.", file=sys.stderr)
        sys.exit(1)

    problems = json.loads(RAW_FILE.read_text())
    print(f"Inserting up to {len(problems)} problems...")
    inserted, skipped = insert_problems(problems)
    print(f"Done: {inserted} inserted, {skipped} skipped (duplicates or already in DB)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Garvit244/Leetcode into DB")
    parser.add_argument("--scrape-only", action="store_true", help="Only fetch and write JSON")
    parser.add_argument("--insert-only", action="store_true", help="Only insert from JSON")
    args = parser.parse_args()

    if args.insert_only:
        run_insert()
    elif args.scrape_only:
        run_scrape()
    else:
        run_scrape()
        run_insert()


if __name__ == "__main__":
    main()
