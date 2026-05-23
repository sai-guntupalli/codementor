"""Sync curated problem text into the DB by slug (description, examples, constraints).

Usage:
    python -m seeds.sync_curated              # fix FizzBuzz only
    python -m seeds.sync_curated --all        # sync every curated slug in DB
    python -m seeds.sync_curated --slug fizzbuzz print-your-name
"""

import argparse
import sys

from seeds.scrapers import curated

DEFAULT_SLUGS = ("fizzbuzz",)


def _curated_by_slug() -> dict[str, dict]:
    return {p["slug"]: p for p in curated.scrape() if p.get("slug")}


def sync(slugs: list[str]) -> int:
    from db.session import SessionLocal
    from models.learning import Problem

    catalog = _curated_by_slug()
    unknown = [s for s in slugs if s not in catalog]
    if unknown:
        print(f"ERROR: unknown slug(s): {', '.join(unknown)}", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    updated = 0
    try:
        for slug in slugs:
            row = db.query(Problem).filter(Problem.slug == slug).first()
            if not row:
                print(f"  skip [{slug}]: not in DB")
                continue
            src = catalog[slug]
            row.description = src["description"]
            row.examples = src.get("examples", [])
            row.constraints = src.get("constraints")
            row.difficulty = src.get("difficulty", row.difficulty)
            row.topic = src.get("topic", row.topic)
            updated += 1
            print(f"  updated [{slug}]: {row.title}")
        db.commit()
        return updated
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync curated problem fields into DB")
    parser.add_argument(
        "--slug",
        nargs="+",
        help="Slug(s) to sync (default: fizzbuzz)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Sync all curated slugs that exist in the DB",
    )
    args = parser.parse_args()

    if args.all:
        from db.session import SessionLocal
        from models.learning import Problem

        catalog = _curated_by_slug()
        db = SessionLocal()
        try:
            db_slugs = {
                r[0]
                for r in db.query(Problem.slug)
                .filter(Problem.slug.in_(catalog.keys()))
                .all()
            }
        finally:
            db.close()
        slugs = sorted(db_slugs)
        print(f"Syncing {len(slugs)} curated problem(s) in DB...")
    elif args.slug:
        slugs = args.slug
    else:
        slugs = list(DEFAULT_SLUGS)
        print(f"Syncing default slug(s): {', '.join(slugs)}")

    count = sync(slugs)
    print(f"Done: {count} problem(s) updated")


if __name__ == "__main__":
    main()
