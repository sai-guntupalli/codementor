"""Bulk-rewrite problem copy to Help Me Code theme (description + examples, no README junk).

Usage:
    python -m seeds.normalize_problems              # LLM → normalized_patch.json
    python -m seeds.normalize_problems --apply      # apply patch + strip titles
    python -m seeds.normalize_problems --dry-run    # list problems that need work
    python -m seeds.normalize_problems --limit 5    # process first N needing normalize
    python -m seeds.normalize_problems --all        # reprocess every problem
    python -m seeds.normalize_problems --fresh      # ignore checkpoint
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

from core.problem_content import (
    needs_normalize,
    normalize_title,
    pre_clean_description,
    validate_normalized,
)
from core.problem_titles import strip_curriculum_prefix

DATA_DIR = Path(__file__).parent / "data"
PATCH_FILE = DATA_DIR / "normalized_patch.json"
CHECKPOINT_FILE = DATA_DIR / "normalized_patch_checkpoint.json"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-haiku-4-5"
CONCURRENCY = 5

SYSTEM_PROMPT = """\
You rewrite coding problems for **Help Me Code**, a friendly Python learning platform.
Problems should read like concise LeetCode-style prompts — not like imported course READMEs.

Respond with ONLY valid JSON. No markdown fences, no commentary.

Schema:
{
  "title": "short human title, no exercise numbers, no emoji",
  "description": "2-5 sentences: what to implement. Markdown allowed for `code` and lists. "
                   "NO sections titled Instructions or Hints. NO emoji. NO numbered module prefixes.",
  "examples": [
    {"input": "concrete stdin or args", "output": "expected stdout", "explanation": "optional"}
  ],
  "constraints": "brief bullet-style constraints string, or null",
  "hints": ["hint 1", "hint 2", "hint 3"]
}

Rules:
- title: strip curriculum ids like `01.5`, `026`, `09.1`; capitalize normally.
- description: state the task clearly. Move pedagogy out — no tutorial walls of text.
- examples: at least 2 with real values (not "see description"). For stdin tasks use literal input text.
- If the task uses randomness, use input "(none)" and sample outputs with explanations that values vary;
  never pair random tasks with fixed stdout test fixtures or stdin counts that imply deterministic lists.
- Example input must be stdin text or "(none)" — never Python expressions like greet('Alice') or foo().
- For algorithm problems keep technical accuracy (inputs/outputs) but stay concise.
- hints: exactly 3 progressive hints; never paste hints into description.
- Do not invent unrelated tasks; stay faithful to the original exercise.
""".strip()


def _make_user_msg(p: dict) -> str:
    desc, extracted_hints = pre_clean_description(p.get("description") or "")
    payload = {
        "title": p["title"],
        "slug": p.get("slug"),
        "difficulty": p.get("difficulty"),
        "language": p.get("language"),
        "source": p.get("source"),
        "description": desc[:2000],
        "examples": p.get("examples") or [],
        "constraints": (p.get("constraints") or "")[:400],
        "extracted_hints": extracted_hints,
    }
    return json.dumps(payload, ensure_ascii=False)


def _clamp_result(r: dict, extracted_hints: list[str]) -> dict:
    title = normalize_title(str(r.get("title") or ""))
    description = str(r.get("description") or "").strip()
    description, more_hints = pre_clean_description(description)
    hints = r.get("hints") if isinstance(r.get("hints"), list) else []
    hints = [str(h).strip() for h in hints if str(h).strip()]
    if len(hints) < 3:
        for h in extracted_hints + more_hints:
            if h not in hints:
                hints.append(h)
            if len(hints) >= 3:
                break
    hints = hints[:3]

    examples = r.get("examples") if isinstance(r.get("examples"), list) else []
    cleaned_examples = []
    for ex in examples:
        if not isinstance(ex, dict):
            continue
        cleaned_examples.append(
            {
                "input": str(ex.get("input", "")).strip(),
                "output": str(ex.get("output", "")).strip(),
                **(
                    {"explanation": str(ex["explanation"]).strip()}
                    if ex.get("explanation")
                    else {}
                ),
            }
        )

    constraints = r.get("constraints")
    if constraints is not None:
        from core.problem_content import _EMOJI_RE

        constraints = _EMOJI_RE.sub("", str(constraints)).strip() or None

    return {
        "title": title,
        "description": description,
        "examples": cleaned_examples,
        "constraints": constraints,
        "hints": hints,
    }


async def _normalize_one(
    client: httpx.AsyncClient,
    p: dict,
    semaphore: asyncio.Semaphore,
    api_key: str,
) -> dict | None:
    raw = ""
    _, extracted_hints = pre_clean_description(p.get("description") or "")
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
                    "max_tokens": 2048,
                    "temperature": 0.2,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": _make_user_msg(p)},
                    ],
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            parsed = json.loads(raw)
            result = _clamp_result(parsed, extracted_hints)
            errors = validate_normalized(
                title=result["title"],
                description=result["description"],
                examples=result["examples"],
                constraints=result.get("constraints"),
            )
            if errors:
                print(
                    f"  INVALID [{p['slug']}]: {', '.join(errors)}",
                    file=sys.stderr,
                )
                return None
            return {"id": p["id"], "slug": p["slug"], **result}
        except json.JSONDecodeError as exc:
            print(f"  JSON-ERROR [{p['slug']}]: {exc} | raw={raw!r:.160}", file=sys.stderr)
            return None
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR [{p['slug']}]: {type(exc).__name__}: {exc}", file=sys.stderr)
            return None


async def _run_batch(problems: list[dict], api_key: str) -> list[dict]:
    semaphore = asyncio.Semaphore(CONCURRENCY)
    results: list[dict] = []
    async with httpx.AsyncClient() as client:
        tasks = [_normalize_one(client, p, semaphore, api_key) for p in problems]
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
                "language": p.language,
                "description": p.description or "",
                "examples": p.examples or [],
                "constraints": p.constraints,
                "hints": p.hints,
                "source": p.source,
                "sort_order": p.sort_order,
            }
            for p in rows
        ]
    finally:
        db.close()


def run_dry_run(force_all: bool = False) -> None:
    problems = _load_problems()
    flagged = [
        p
        for p in problems
        if force_all
        or needs_normalize(
            title=p["title"],
            description=p["description"],
            examples=p.get("examples"),
        )
    ]
    print(f"Total problems: {len(problems)}")
    print(f"Need normalization: {len(flagged)}")
    for p in flagged[:15]:
        print(f"  - {p['slug']}: {p['title'][:60]}")
    if len(flagged) > 15:
        print(f"  ... and {len(flagged) - 15} more")


def run_normalize(
    *,
    fresh: bool = False,
    force_all: bool = False,
    limit: int | None = None,
) -> None:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    problems = _load_problems()
    print(f"Loaded {len(problems)} problems from DB")

    if force_all:
        remaining = problems
    else:
        remaining = [
            p
            for p in problems
            if needs_normalize(
                title=p["title"],
                description=p["description"],
                examples=p.get("examples"),
            )
        ]
    print(f"Queued for LLM: {len(remaining)}")
    if limit is not None:
        remaining = remaining[:limit]
        print(f"Limited to {limit}")

    existing: list[dict] = []
    if not fresh and CHECKPOINT_FILE.exists():
        existing = json.loads(CHECKPOINT_FILE.read_text())
        done_ids = {r["id"] for r in existing}
        remaining = [p for p in remaining if p["id"] not in done_ids]
        print(f"Resuming: {len(existing)} done, {len(remaining)} remaining")

    if remaining:
        new_results = asyncio.run(_run_batch(remaining, api_key))
        all_results = existing + new_results
    else:
        all_results = existing
        print("Nothing to process")

    PATCH_FILE.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(all_results)} records → {PATCH_FILE}")
    print("Review, then: python -m seeds.normalize_problems --apply")


def run_apply() -> None:
    if not PATCH_FILE.exists():
        print(f"ERROR: {PATCH_FILE} not found. Run normalization first.", file=sys.stderr)
        sys.exit(1)

    patch = json.loads(PATCH_FILE.read_text())
    patch_by_id = {r["id"]: r for r in patch}
    print(f"Applying {len(patch_by_id)} patches to DB...")

    from db.session import SessionLocal
    from models.learning import Problem

    db = SessionLocal()
    updated = 0
    titles_only = 0
    try:
        for problem in db.query(Problem).all():
            pid = str(problem.id)
            cleaned_title = strip_curriculum_prefix(problem.title)
            if cleaned_title != problem.title:
                problem.title = cleaned_title
                titles_only += 1

            if pid not in patch_by_id:
                continue
            r = patch_by_id[pid]
            problem.title = r.get("title") or problem.title
            problem.description = r["description"]
            problem.examples = r.get("examples") or []
            if "constraints" in r:
                problem.constraints = r.get("constraints")
            if r.get("hints"):
                problem.hints = r["hints"]
            updated += 1

        db.commit()
        print(f"Done: {updated} problems fully updated, {titles_only} title-only cleanups")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize problem copy for Help Me Code")
    parser.add_argument("--apply", action="store_true", help="Apply patch to DB")
    parser.add_argument("--dry-run", action="store_true", help="List problems needing work")
    parser.add_argument("--fresh", action="store_true", help="Ignore checkpoint")
    parser.add_argument("--all", action="store_true", help="Reprocess every problem")
    parser.add_argument("--limit", type=int, default=None, help="Max problems to send to LLM")
    args = parser.parse_args()

    if args.dry_run:
        run_dry_run(force_all=args.all)
    elif args.apply:
        run_apply()
    else:
        run_normalize(fresh=args.fresh, force_all=args.all, limit=args.limit)


if __name__ == "__main__":
    main()
