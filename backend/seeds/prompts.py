from db.session import SessionLocal
from models.content import Prompt

PROMPTS = [
    {
        "name": "code_review",
        "version": 1,
        "variables": ["code", "language", "problem", "user_level"],
        "template": "You are an expert {language} developer reviewing code submitted by a {user_level}-level learner.\n\nProblem: {problem}\n\nSubmitted code:\n```{language}\n{code}\n```\n\nProvide:\n## Issues Found\nList each issue suited to a {user_level}-level learner.\n\n## Improved Code\n```{language}\n[improved code here]\n```\n\n## Why This Is Better\nExplain improvements for a {user_level}-level learner.",
    },
    {
        "name": "hint_generator",
        "version": 1,
        "variables": ["problem", "code_so_far", "hint_number", "user_level"],
        "template": "You are helping a {user_level}-level learner. Give hint #{hint_number} of 3.\n\nProblem: {problem}\n\nTheir code so far:\n{code_so_far}\n\nRules:\n- NEVER give away the solution\n- Hint 1: conceptual direction\n- Hint 2: specific technique or data structure\n- Hint 3: concrete nudge, still no solution\n- Adapt language for {user_level}-level\n\nGive only the hint.",
    },
    {
        "name": "solution_generator",
        "version": 1,
        "variables": ["problem", "language", "solution_level", "user_level"],
        "template": "You are an expert {language} developer. Provide a {solution_level} solution.\n\nProblem: {problem}\n\nLevels: beginner | learner | industry_standard | optimal_time | optimal_space | interview_ready\n\nProvide the {solution_level} solution in {language} with brief comments on key decisions.",
    },
    {
        "name": "teach_me",
        "version": 1,
        "variables": ["code", "explain_style", "user_level", "language"],
        "template": "You are teaching a {user_level}-level learner to understand this {language} code.\n\nCode:\n```{language}\n{code}\n```\n\nStyle: {explain_style} (technical | simple | eli5)\n\nGo line by line. For each part: what it does, why it's written this way, any gotchas.",
    },
    {
        "name": "surprise_me",
        "version": 1,
        "variables": ["language", "user_skill_level", "topic_focus", "avoid_recent_ids"],
        "template": "Generate a coding problem for a {user_skill_level}-level {language} programmer.\nTopic: {topic_focus}\nAvoid IDs: {avoid_recent_ids}\n\nReturn ONLY valid JSON:\n{{\n  \"title\": \"...\",\n  \"description\": \"...\",\n  \"difficulty\": \"easy|medium|hard\",\n  \"topic\": [\"...\"],\n  \"examples\": {{\"input\": \"...\", \"output\": \"...\", \"explanation\": \"...\"}},\n  \"constraints\": \"...\"\n}}",
    },
    {
        "name": "skill_assessor",
        "version": 1,
        "variables": ["recent_submissions", "current_level"],
        "template": "Assess a programmer's skill from recent submissions.\n\nCurrent level: {current_level} (1.0-5.0)\nSubmissions:\n{recent_submissions}\n\nReturn ONLY valid JSON:\n{{\n  \"level\": 2.5,\n  \"weak\": [\"list comprehensions\"],\n  \"next\": [\"generators\"],\n  \"summary\": \"One sentence assessment.\"\n}}",
    },
]


def seed_prompts() -> None:
    db = SessionLocal()
    try:
        if db.query(Prompt).count() > 0:
            print("Prompts already seeded, skipping.")
            return
        db.add_all([Prompt(**p) for p in PROMPTS])
        db.commit()
        print(f"Seeded {len(PROMPTS)} prompts.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_prompts()
