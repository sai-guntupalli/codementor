from db.session import SessionLocal
from models.content import Prompt

PROMPT_MAX_TOKENS: dict[str, int] = {
    "code_review": 1200,
    "hint_generator": 400,
    "solution_generator": 800,
    "teach_me": 800,
    "surprise_me": 500,
    "skill_assessor": 800,
}

PROMPTS = [
    {
        "name": "code_review",
        "version": 2,
        "max_tokens": 1200,
        "variables": ["code", "language", "problem", "user_level"],
        "template": """You are a concise {language} tutor reviewing a {user_level}-level learner's submission.

Problem:
{problem}

Code:
```{language}
{code}
```

Output markdown only. Be brief — no filler, no long praise.

If the code correctly solves the problem:
## Verdict
Correct — meets the requirements.
(Optional) ## Tip
At most one short optional note, or omit Tip entirely.

If the code is wrong or incomplete:
## Verdict
Needs work — one short line stating why.
## Fix
Up to 3 bullet points, each one specific issue.
## Improved Code
```{language}
[fixed code]
```
## Why
One or two sentences on what changed.

Rules:
- Do NOT use an "Issues Found" heading.
- Do NOT list issues when the solution is already correct.
- Do NOT include Improved Code when the submitted code is already correct.""",
    },
    {
        "name": "hint_generator",
        "version": 2,
        "max_tokens": 400,
        "variables": ["problem", "code_so_far", "hint_number", "user_level"],
        "template": """Give hint #{hint_number} of 3 for a {user_level}-level learner.

Problem: {problem}

Their code so far:
{code_so_far}

Rules:
- 2–4 sentences max.
- Never reveal the full solution.
- Hint 1: direction only. Hint 2: technique or structure. Hint 3: concrete nudge, still no answer.
- Match {user_level} vocabulary.""",
    },
    {
        "name": "solution_generator",
        "version": 2,
        "max_tokens": 800,
        "variables": ["problem", "language", "solution_level", "user_level"],
        "template": """Write a {solution_level} {language} solution for a {user_level}-level learner.

Problem: {problem}

Format:
## Solution
```{language}
[code]
```
## Key points
Up to 3 short bullets on why this fits the {solution_level} level.

Keep it tight — no essay.""",
    },
    {
        "name": "teach_me",
        "version": 2,
        "max_tokens": 800,
        "variables": ["code", "explain_style", "user_level", "language"],
        "template": """Explain this {language} code to a {user_level}-level learner.

Style: {explain_style} (technical | simple | eli5)

```{language}
{code}
```

Walk through the code in order. For each logical chunk: one line what it does, one line why (if needed). Skip obvious lines. Max ~12 lines total unless the code is long.""",
    },
    {
        "name": "surprise_me",
        "version": 2,
        "max_tokens": 500,
        "variables": ["language", "user_skill_level", "topic_focus", "avoid_recent_ids"],
        "template": """Generate one {language} coding problem for skill level {user_skill_level}.
Topic: {topic_focus}
Avoid repeating IDs: {avoid_recent_ids}

Return ONLY valid JSON:
{{
  "title": "...",
  "description": "...",
  "difficulty": "easy|medium|hard",
  "topic": ["..."],
  "examples": {{"input": "...", "output": "...", "explanation": "..."}},
  "constraints": "..."
}}""",
    },
    {
        "name": "skill_assessor",
        "version": 2,
        "max_tokens": 800,
        "variables": ["recent_submissions", "current_level"],
        "template": """Assess skill from recent submissions.

Current level: {current_level} (1.0–5.0)
Submissions:
{recent_submissions}

Return ONLY valid JSON:
{{
  "level": 2.5,
  "weak": ["..."],
  "next": ["..."],
  "summary": "One sentence."
}}""",
    },
]


def seed_prompts() -> None:
    db = SessionLocal()
    try:
        if db.query(Prompt).count() > 0:
            updated = 0
            for name, max_tokens in PROMPT_MAX_TOKENS.items():
                rows = db.query(Prompt).filter(Prompt.name == name).all()
                for row in rows:
                    if row.max_tokens != max_tokens:
                        row.max_tokens = max_tokens
                        updated += 1
            if updated:
                db.commit()
                print(f"Updated max_tokens on {updated} prompt row(s).")
            else:
                print("Prompts already seeded, skipping.")
            return
        db.add_all([Prompt(**p) for p in PROMPTS])
        db.commit()
        print(f"Seeded {len(PROMPTS)} prompts.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_prompts()
