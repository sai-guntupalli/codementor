"""Variable builders for practice-flow LLM prompts."""

import json
import re
import uuid

from models.learning import Problem
from models.users import User

SOLUTION_LEVELS = frozenset(
    {
        "beginner",
        "learner",
        "industry_standard",
        "optimal_time",
        "optimal_space",
        "interview_ready",
    }
)

EXPLAIN_STYLES = frozenset({"technical", "simple", "eli5"})


def problem_text(problem: Problem) -> str:
    return f"{problem.title}\n\n{problem.description}"


def hint_variables(problem: Problem, user: User, code: str, hint_number: int) -> dict[str, str]:
    return {
        "problem": problem_text(problem),
        "code_so_far": code or "(no code yet)",
        "hint_number": str(hint_number),
        "user_level": user.profile_level,
    }


def solution_variables(
    problem: Problem, user: User, solution_level: str
) -> dict[str, str]:
    return {
        "problem": problem_text(problem),
        "language": problem.language,
        "solution_level": solution_level,
        "user_level": user.profile_level,
    }


def teach_variables(
    user: User, code: str, language: str, explain_style: str
) -> dict[str, str]:
    return {
        "code": code,
        "language": language,
        "explain_style": explain_style,
        "user_level": user.profile_level,
    }


def surprise_variables(
    user: User,
    language: str,
    topic_focus: str,
    avoid_recent_ids: list[uuid.UUID],
) -> dict[str, str]:
    skill = user.skill_level or {}
    level = skill.get(language, skill.get("default", 1))
    return {
        "language": language,
        "user_skill_level": str(level),
        "topic_focus": topic_focus or "general",
        "avoid_recent_ids": ", ".join(str(i) for i in avoid_recent_ids) or "none",
    }


def parse_surprise_problem_json(raw: str) -> dict:
    """Extract JSON object from LLM output."""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in surprise_me response")
    return json.loads(text[start : end + 1])


def user_skill_level(user: User, language: str) -> float:
    skill = user.skill_level or {}
    raw = skill.get(language, skill.get("default", 1))
    try:
        return float(raw)
    except (TypeError, ValueError):
        return 1.0
