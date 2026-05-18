"""One-time script to backfill examples for problems that have an empty examples list.

Usage:
    cd backend
    uv run python -m seeds.backfill_examples
"""

import json
import sys
import time

import httpx

sys.path.insert(0, ".")

from core.config import settings
from db.session import SessionLocal
from models.learning import Problem

PROMPT = """\
You are generating test examples for a coding problem.

Problem title: {title}
Language: {language}
Description:
{description}

Return a JSON array of 2-3 examples. Each example has:
  - "input": string describing the input (e.g. "nums = [1,2,3]")
  - "output": string describing the expected output (e.g. "6")
  - "explanation": brief explanation string (can be empty string if obvious)

Return ONLY the raw JSON array, no markdown fences, no extra text.
"""


def generate_examples(title: str, language: str, description: str, api_key: str) -> list[dict]:
    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": PROMPT.format(
                    title=title, language=language, description=description[:1500]
                ),
            }
        ],
        "max_tokens": 500,
        "temperature": 0.2,
    }
    resp = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"].strip()
    # Strip markdown fences if present
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content.strip())


def main() -> None:
    if not settings.openrouter_api_key:
        print("ERROR: OPENROUTER_API_KEY not set in environment.")
        sys.exit(1)

    db = SessionLocal()
    try:
        problems = (
            db.query(Problem)
            .filter(Problem.examples == [])
            .filter(Problem.is_published.is_(True))
            .all()
        )
        print(f"Found {len(problems)} published problems with empty examples.")

        updated = 0
        failed = 0
        for i, prob in enumerate(problems, 1):
            print(f"[{i}/{len(problems)}] {prob.title} ...", end=" ", flush=True)
            try:
                examples = generate_examples(
                    prob.title, prob.language, prob.description, settings.openrouter_api_key
                )
                if not isinstance(examples, list) or len(examples) == 0:
                    raise ValueError("Empty or invalid response")
                prob.examples = examples
                db.commit()
                print(f"OK ({len(examples)} examples)")
                updated += 1
            except Exception as exc:
                db.rollback()
                print(f"FAILED: {exc}")
                failed += 1
            # Polite rate-limiting
            time.sleep(0.5)

        print(f"\nDone. Updated: {updated}, Failed: {failed}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
