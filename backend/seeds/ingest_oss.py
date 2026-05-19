"""OSS problem ingestion pipeline.

Usage:
    # Scrape → write oss_problems.json (dry run, review before insert)
    python -m seeds.ingest_oss

    # Insert from oss_problems.json into DB
    python -m seeds.ingest_oss --insert
"""

import argparse
import json
import sys
from difflib import SequenceMatcher
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "oss_problems.json"
EXISTING_FILE = DATA_DIR / "enriched_problems.json"

DEDUP_RATIO = 0.82


def _fuzzy_match(a: str, b: str) -> bool:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() > DEDUP_RATIO


def _load_existing_slugs_and_titles() -> tuple[set[str], list[str]]:
    if not EXISTING_FILE.exists():
        return set(), []
    data = json.loads(EXISTING_FILE.read_text())
    slugs = {p["slug"] for p in data if p.get("slug")}
    titles = [p["title"] for p in data if p.get("title")]
    return slugs, titles


def _dedup(
    problems: list[dict], existing_slugs: set[str], existing_titles: list[str]
) -> list[dict]:
    seen_slugs: set[str] = set(existing_slugs)
    seen_titles: list[str] = list(existing_titles)
    result: list[dict] = []

    for p in problems:
        slug = p.get("slug", "")
        title = p.get("title", "")

        if slug and slug in seen_slugs:
            continue

        if any(_fuzzy_match(title, t) for t in seen_titles):
            continue

        seen_slugs.add(slug)
        seen_titles.append(title)
        result.append(p)

    return result


def _scrape() -> list[dict]:
    from seeds.scrapers import curated, exercism, four_geeks

    print("Scraping curated problems...")
    curated_problems = curated.scrape()
    print(f"  {len(curated_problems)} curated problems")

    print("Scraping 4GeeksAcademy repos...")
    four_geeks_problems = four_geeks.scrape()
    print(f"  {len(four_geeks_problems)} 4GeeksAcademy problems")

    print("Scraping Exercism/python repo...")
    exercism_problems = exercism.scrape()
    print(f"  {len(exercism_problems)} Exercism problems (difficulty ≤ 5)")

    return curated_problems + four_geeks_problems + exercism_problems


def _validate(problem: dict) -> list[str]:
    errors = []
    if not problem.get("title"):
        errors.append("missing title")
    if not problem.get("description") or len(problem["description"]) < 10:
        errors.append("description too short")
    if not problem.get("difficulty"):
        errors.append("missing difficulty")
    if not problem.get("examples") or len(problem["examples"]) < 1:
        errors.append("no examples")
    if problem.get("sort_order") is None:
        errors.append("missing sort_order")
    return errors


def run_scrape() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing_slugs, existing_titles = _load_existing_slugs_and_titles()
    print(f"Baseline: {len(existing_slugs)} existing slugs loaded for dedup")

    raw = _scrape()
    print(f"\nTotal scraped (pre-dedup): {len(raw)}")

    deduped = _dedup(raw, existing_slugs, existing_titles)
    print(f"After dedup: {len(deduped)}")

    # Validate and report issues
    invalid = 0
    for p in deduped:
        errs = _validate(p)
        if errs:
            invalid += 1
            print(f"  WARN [{p.get('slug')}]: {', '.join(errs)}")

    if invalid:
        print(f"\n{invalid} problems have validation warnings (still included)")

    OUTPUT_FILE.write_text(json.dumps(deduped, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(deduped)} problems → {OUTPUT_FILE}")
    print("\nReview the file, then run: python -m seeds.ingest_oss --insert")


def run_insert() -> None:
    if not OUTPUT_FILE.exists():
        print(f"ERROR: {OUTPUT_FILE} not found. Run scrape first.", file=sys.stderr)
        sys.exit(1)

    problems = json.loads(OUTPUT_FILE.read_text())
    print(f"Inserting {len(problems)} problems into DB...")

    # Import DB deps here so scrape mode works without DB env vars
    from db.session import SessionLocal
    from models.learning import Problem

    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        existing_slugs = {
            r[0] for r in db.query(Problem.slug).filter(Problem.slug.isnot(None)).all()
        }

        for p in problems:
            slug = p.get("slug")
            if slug and slug in existing_slugs:
                skipped += 1
                continue

            problem = Problem(
                title=p["title"],
                slug=slug,
                description=p["description"],
                difficulty=p.get("difficulty", "easy"),
                language=p.get("language", "python"),
                topic=p.get("topic", []),
                examples=p.get("examples", []),
                constraints=p.get("constraints"),
                source=p.get("source", "imported"),
                source_url=p.get("source_url"),
                is_published=p.get("is_published", True),
                sort_order=p.get("sort_order"),
            )
            db.add(problem)
            existing_slugs.add(slug or "")
            inserted += 1

        db.commit()
        print(f"Done: {inserted} inserted, {skipped} skipped (already exist)")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="OSS problem ingestion pipeline")
    parser.add_argument("--insert", action="store_true", help="Insert oss_problems.json into DB")
    args = parser.parse_args()

    if args.insert:
        run_insert()
    else:
        run_scrape()


if __name__ == "__main__":
    main()
