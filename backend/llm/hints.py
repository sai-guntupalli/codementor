"""Stored hints: lazy generation and validation."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from llm.openrouter import complete_chat
from llm.pricing import compute_cost
from llm.practice import MAX_HINTS, normalize_hints
from llm.router import resolve_model
from llm.streaming import log_stream_usage
from models.learning import Problem
from models.users import User

HINTS_SYSTEM_PROMPT = """\
You write progressive hints for a coding learning platform.

Respond with ONLY valid JSON — no markdown fences, no extra text.

Schema:
{
  "hints": [
    "hint 1: direction only, 2-3 sentences",
    "hint 2: technique or structure, 2-3 sentences",
    "hint 3: concrete nudge, still no full answer, 2-3 sentences"
  ]
}

Rules:
- Exactly 3 hints in the array.
- Never reveal the complete solution or full code.
- Hint 1: what to think about / approach direction.
- Hint 2: algorithm, pattern, or structure to use.
- Hint 3: specific next step without writing the answer.
- Use plain language appropriate for the stated difficulty.
""".strip()


def parse_hints_response(raw: str) -> list[str] | None:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    hints = parsed.get("hints")
    if not isinstance(hints, list):
        return None
    cleaned = [h.strip() for h in hints if isinstance(h, str) and h.strip()]
    if len(cleaned) < MAX_HINTS:
        return None
    return cleaned[:MAX_HINTS]


def _user_message(problem: Problem) -> str:
    return json.dumps(
        {
            "title": problem.title,
            "difficulty": problem.difficulty,
            "language": problem.language,
            "description": (problem.description or "")[:800],
            "constraints": (problem.constraints or "")[:400],
        },
        ensure_ascii=False,
    )


async def generate_hints_for_problem(
    db: Session,
    problem: Problem,
    user: User,
) -> list[str]:
    """Call LLM once to produce 3 hints for a problem."""
    model = resolve_model(db, user)
    messages = [
        {"role": "system", "content": HINTS_SYSTEM_PROMPT},
        {"role": "user", "content": _user_message(problem)},
    ]
    raw, usage = await complete_chat(model=model, messages=messages, max_tokens=512)
    hints = parse_hints_response(raw)
    if not hints:
        raise ValueError("LLM returned invalid hints JSON")

    input_tokens = 0
    output_tokens = 0
    if usage:
        input_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        output_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    tokens = input_tokens + output_tokens
    if not tokens and usage:
        tokens = int(usage.get("total_tokens") or 0)
    cost = float(usage.get("cost") or 0.0) if usage else 0.0
    if cost == 0.0 and (input_tokens > 0 or output_tokens > 0):
        cost = compute_cost(model, input_tokens, output_tokens)
    log_stream_usage(
        db,
        user=user,
        event_type="hint_generate",
        prompt_name="hints_lazy",
        model=model,
        tokens_used=tokens,
        cost_usd=cost,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        problem_id=problem.id,
    )
    return hints


def hints_are_complete(problem: Problem) -> bool:
    return len(normalize_hints(problem.hints)) >= MAX_HINTS


async def ensure_problem_hints(
    db: Session,
    problem: Problem,
    user: User,
) -> Problem:
    """Return problem with hints populated; generate once if missing (row-locked)."""
    if hints_are_complete(problem):
        return problem

    locked = (
        db.query(Problem)
        .filter(Problem.id == problem.id)
        .with_for_update()
        .first()
    )
    if locked is None:
        return problem
    if hints_are_complete(locked):
        return locked

    locked.hints = await generate_hints_for_problem(db, locked, user)
    db.add(locked)
    db.commit()
    db.refresh(locked)
    return locked
