"""Helpers for code-review streaming on submissions."""

import re

from models.learning import Problem, Submission
from models.users import User


def build_code_review_variables(
    submission: Submission,
    problem: Problem,
    user: User,
) -> dict[str, str]:
    problem_text = f"{problem.title}\n\n{problem.description}"
    return {
        "code": submission.code,
        "language": submission.language,
        "problem": problem_text,
        "user_level": user.profile_level,
    }


def extract_improved_code(review_text: str, language: str) -> str | None:
    """Pull fenced code from Improved Code section; skip when verdict says correct."""
    if re.search(
        r"##\s*Verdict\s*\n+.*\b(correct|looks good|no changes needed)\b",
        review_text,
        re.IGNORECASE | re.DOTALL,
    ):
        return None

    section_match = re.search(
        r"##\s*Improved\s+Code\s*\n+(.*?)(?:\n##\s|\Z)",
        review_text,
        re.DOTALL | re.IGNORECASE,
    )
    block = section_match.group(1) if section_match else ""
    if not block.strip():
        return None
    fence = re.search(
        rf"```(?:{re.escape(language)})?\s*\n(.*?)```",
        block,
        re.DOTALL | re.IGNORECASE,
    )
    if fence:
        return fence.group(1).strip()
    return None
