"""Bulk-enrich all problems: reassign difficulty and tags using Claude Haiku.

Usage:
    # Run enrichment → writes seeds/data/enriched_patch.json
    python -m seeds.enrich_problems

    # Apply patch to DB
    python -m seeds.enrich_problems --apply

    # Re-enrich from scratch (ignore checkpoint)
    python -m seeds.enrich_problems --fresh
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

DATA_DIR = Path(__file__).parent / "data"
PATCH_FILE = DATA_DIR / "enriched_patch.json"
CHECKPOINT_FILE = DATA_DIR / "enriched_patch_checkpoint.json"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-haiku-4-5"
CONCURRENCY = 5

# ── Tag taxonomy ──────────────────────────────────────────────────────────────
VALID_TAGS = {
    "strings", "arrays", "math", "conditionals", "loops", "functions",
    "recursion", "sorting", "searching", "hash-map", "sets", "linked-list",
    "binary-tree", "graph", "dynamic-programming", "two-pointers",
    "binary-search", "stack", "queue", "matrix", "simulation", "greedy",
    "backtracking", "io", "basics",
}

SYSTEM_PROMPT = """\
You are an expert programming educator classifying coding problems for a \
learning platform targeted at COMMON users — hobbyists, students, career \
changers — NOT professional software engineers.

Respond with ONLY valid JSON. No markdown, no explanation, no code fences.

Schema:
{
  "difficulty": "beginner|easy|medium|hard",
  "topic": ["tag1", "tag2", ...],
  "title_fix": "improved title or null if fine",
  "description_fix": "improved 1-3 sentence description or null if fine"
}

Difficulty guide (think: what week of learning is this appropriate for?):
- beginner : Week 1 — print, variables, basic arithmetic, input/output
- easy     : Weeks 2–6 — if/else, for loops, while, basic string ops, simple functions
- medium   : Months 2–6 — lists, dicts, nested loops, recursion, sorting, searching
- hard     : Months 6+ — advanced DS (trees, graphs, linked lists), DP, backtracking

Valid tags (pick 2–5 most accurate):
strings, arrays, math, conditionals, loops, functions, recursion, sorting,
searching, hash-map, sets, linked-list, binary-tree, graph,
dynamic-programming, two-pointers, binary-search, stack, queue, matrix,
simulation, greedy, backtracking, io, basics

Rules:
- difficulty MUST be one of: beginner, easy, medium, hard
- topic MUST be a JSON array of valid tags from the list above
- title_fix: only if the current title is unclear or misleading; else null
- description_fix: only if description is missing, broken, or very low quality; else null
- For LeetCode-style problems (Two Sum, Binary Search, etc.) use harder difficulties
- For print/input/basic-math problems use beginner
- For simple loop/string problems use easy
""".strip()


def _make_user_msg(p: dict) -> str:
    return json.dumps(
        {
            "title": p["title"],
            "current_difficulty": p["difficulty"],
            "current_topic": p["topic"],
            "description": (p.get("description") or "")[:600],
            "source": p.get("source", ""),
            "sort_order": p.get("sort_order"),
        },
        ensure_ascii=False,
    )


async def _enrich_one(
    client: httpx.AsyncClient,
    p: dict,
    semaphore: asyncio.Semaphore,
    api_key: str,
) -> dict | None:
    raw = ""
    async with semaphore:
        try:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 256,
                    "temperature": 0.1,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": _make_user_msg(p)},
                    ],
                },
                timeout=30.0,
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            # Strip markdown fences if model wrapped it
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            result = json.loads(raw)
            return {"id": p["id"], "slug": p["slug"], **result}
        except json.JSONDecodeError as exc:
            print(f"  JSON-ERROR [{p['slug']}]: {exc} | raw={raw!r:.120}", file=sys.stderr)
            return None
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR [{p['slug']}]: {type(exc).__name__}: {exc}", file=sys.stderr)
            return None


async def _run_enrichment(problems: list[dict], api_key: str) -> list[dict]:
    semaphore = asyncio.Semaphore(CONCURRENCY)
    results: list[dict] = []
    async with httpx.AsyncClient() as client:
        tasks = [_enrich_one(client, p, semaphore, api_key) for p in problems]
        total = len(tasks)
        done = 0
        for coro in asyncio.as_completed(tasks):
            res = await coro
            done += 1
            if res:
                results.append(res)
            if done % 50 == 0 or done == total:
                print(f"  {done}/{total} processed ({len(results)} ok)")
                # Save checkpoint after every 50
                CHECKPOINT_FILE.write_text(
                    json.dumps(results, indent=2, ensure_ascii=False)
                )
    return results


def _load_problems() -> list[dict]:
    from db.session import SessionLocal
    from models.learning import Problem

    db = SessionLocal()
    try:
        rows = db.query(Problem).order_by(Problem.sort_order.asc().nulls_last()).all()
        return [
            {
                "id": str(p.id),
                "title": p.title,
                "slug": p.slug or "",
                "difficulty": p.difficulty,
                "topic": p.topic or [],
                "description": p.description or "",
                "source": p.source,
                "sort_order": p.sort_order,
            }
            for p in rows
        ]
    finally:
        db.close()


def _validate_result(r: dict) -> dict:
    """Clamp difficulty and strip invalid tags."""
    valid_diffs = {"beginner", "easy", "medium", "hard"}
    if r.get("difficulty") not in valid_diffs:
        r["difficulty"] = "easy"
    tags = [t for t in (r.get("topic") or []) if t in VALID_TAGS]
    r["topic"] = tags or ["basics"]
    return r


def run_enrich(fresh: bool = False) -> None:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    problems = _load_problems()
    print(f"Loaded {len(problems)} problems from DB")

    # If resuming from checkpoint, skip already-processed IDs
    existing: list[dict] = []
    if not fresh and CHECKPOINT_FILE.exists():
        existing = json.loads(CHECKPOINT_FILE.read_text())
        done_ids = {r["id"] for r in existing}
        remaining = [p for p in problems if p["id"] not in done_ids]
        print(f"Resuming: {len(existing)} done, {len(remaining)} remaining")
    else:
        remaining = problems

    if remaining:
        new_results = asyncio.run(_run_enrichment(remaining, api_key))
        all_results = existing + new_results
    else:
        all_results = existing
        print("Nothing to process — all problems already in checkpoint")

    # Validate and clean
    all_results = [_validate_result(r) for r in all_results]

    PATCH_FILE.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(all_results)} enriched records → {PATCH_FILE}")
    print("Review, then run: python -m seeds.enrich_problems --apply")


def run_apply() -> None:
    if not PATCH_FILE.exists():
        print(f"ERROR: {PATCH_FILE} not found. Run enrichment first.", file=sys.stderr)
        sys.exit(1)

    patch = json.loads(PATCH_FILE.read_text())
    patch_by_id = {r["id"]: r for r in patch}
    print(f"Applying {len(patch_by_id)} enrichment patches to DB...")

    from db.session import SessionLocal
    from models.learning import Problem

    db = SessionLocal()
    updated = 0
    try:
        for problem in db.query(Problem).all():
            pid = str(problem.id)
            if pid not in patch_by_id:
                continue
            r = patch_by_id[pid]

            problem.difficulty = r["difficulty"]
            problem.topic = r["topic"]
            if r.get("title_fix"):
                problem.title = r["title_fix"]
            if r.get("description_fix"):
                problem.description = r["description_fix"]
            updated += 1

        db.commit()
        print(f"Done: {updated} problems updated")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk-enrich problem tags and difficulty")
    parser.add_argument("--apply", action="store_true", help="Apply patch to DB")
    parser.add_argument("--fresh", action="store_true", help="Ignore checkpoint and re-enrich all")
    args = parser.parse_args()

    if args.apply:
        run_apply()
    else:
        run_enrich(fresh=args.fresh)


if __name__ == "__main__":
    main()
