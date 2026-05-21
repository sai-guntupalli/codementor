"""One-time bulk generation of 3 stored hints per problem (minimize runtime LLM).

Usage:
    python -m seeds.generate_hints              # write hints_patch.json
    python -m seeds.generate_hints --apply      # apply to DB
    python -m seeds.generate_hints --fresh        # ignore checkpoint
    python -m seeds.generate_hints --only-missing # skip problems that already have 3 hints
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

from llm.hints import HINTS_SYSTEM_PROMPT, parse_hints_response
from llm.practice import MAX_HINTS, normalize_hints

DATA_DIR = Path(__file__).parent / "data"
PATCH_FILE = DATA_DIR / "hints_patch.json"
CHECKPOINT_FILE = DATA_DIR / "hints_patch_checkpoint.json"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-haiku-4-5"
CONCURRENCY = 5

def _make_user_msg(p: dict) -> str:
    return json.dumps(
        {
            "title": p["title"],
            "difficulty": p["difficulty"],
            "language": p["language"],
            "description": (p.get("description") or "")[:800],
            "constraints": (p.get("constraints") or "")[:400],
        },
        ensure_ascii=False,
    )


async def _generate_one(
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
                    "max_tokens": 512,
                    "temperature": 0.2,
                    "messages": [
                        {"role": "system", "content": HINTS_SYSTEM_PROMPT},
                        {"role": "user", "content": _make_user_msg(p)},
                    ],
                },
                timeout=45.0,
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            hints = parse_hints_response(raw)
            if not hints:
                print(f"  INVALID [{p['slug']}]: bad hints shape", file=sys.stderr)
                return None
            return {"id": p["id"], "slug": p["slug"], "hints": hints}
        except json.JSONDecodeError as exc:
            print(f"  JSON-ERROR [{p['slug']}]: {exc} | raw={raw!r:.120}", file=sys.stderr)
            return None
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR [{p['slug']}]: {type(exc).__name__}: {exc}", file=sys.stderr)
            return None


async def _run_generation(problems: list[dict], api_key: str) -> list[dict]:
    semaphore = asyncio.Semaphore(CONCURRENCY)
    results: list[dict] = []
    async with httpx.AsyncClient() as client:
        tasks = [_generate_one(client, p, semaphore, api_key) for p in problems]
        total = len(tasks)
        done = 0
        for coro in asyncio.as_completed(tasks):
            res = await coro
            done += 1
            if res:
                results.append(res)
            if done % 25 == 0 or done == total:
                print(f"  {done}/{total} processed ({len(results)} ok)")
                CHECKPOINT_FILE.write_text(
                    json.dumps(results, indent=2, ensure_ascii=False)
                )
    return results


def _load_problems(only_missing: bool) -> list[dict]:
    from db.session import SessionLocal
    from models.learning import Problem

    db = SessionLocal()
    try:
        rows = db.query(Problem).order_by(Problem.sort_order.asc().nulls_last()).all()
        out = []
        for p in rows:
            if only_missing and len(normalize_hints(p.hints)) >= MAX_HINTS:
                continue
            out.append(
                {
                    "id": str(p.id),
                    "slug": p.slug or "",
                    "title": p.title,
                    "description": p.description or "",
                    "difficulty": p.difficulty,
                    "language": p.language,
                    "constraints": p.constraints,
                }
            )
        return out
    finally:
        db.close()


def run_generate(*, fresh: bool, only_missing: bool) -> None:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    problems = _load_problems(only_missing)
    print(f"Generating hints for {len(problems)} problems")

    existing: list[dict] = []
    if not fresh and CHECKPOINT_FILE.exists():
        existing = json.loads(CHECKPOINT_FILE.read_text())
        done_ids = {r["id"] for r in existing}
        problems = [p for p in problems if p["id"] not in done_ids]
        print(f"Resuming: {len(existing)} done, {len(problems)} remaining")

    if problems:
        new_results = asyncio.run(_run_generation(problems, api_key))
        all_results = existing + new_results
    else:
        all_results = existing
        print("Nothing to process")

    PATCH_FILE.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(all_results)} hint records → {PATCH_FILE}")
    print("Review, then run: python -m seeds.generate_hints --apply")


def run_apply() -> None:
    if not PATCH_FILE.exists():
        print(f"ERROR: {PATCH_FILE} not found. Run generation first.", file=sys.stderr)
        sys.exit(1)

    patch = json.loads(PATCH_FILE.read_text())
    patch_by_id = {r["id"]: r for r in patch}
    print(f"Applying hints for {len(patch_by_id)} problems...")

    from db.session import SessionLocal
    from models.learning import Problem

    db = SessionLocal()
    updated = 0
    try:
        for problem in db.query(Problem).all():
            pid = str(problem.id)
            if pid not in patch_by_id:
                continue
            problem.hints = patch_by_id[pid]["hints"]
            updated += 1
        db.commit()
        print(f"Done: {updated} problems updated with stored hints")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate stored hints for problems")
    parser.add_argument("--apply", action="store_true", help="Apply patch to DB")
    parser.add_argument("--fresh", action="store_true", help="Ignore checkpoint")
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Only problems without 3 hints already stored",
    )
    args = parser.parse_args()

    if args.apply:
        run_apply()
    else:
        run_generate(fresh=args.fresh, only_missing=args.only_missing)


if __name__ == "__main__":
    main()
