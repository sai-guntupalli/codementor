"""Deterministic skill assessment from code review output."""

import re

from sqlalchemy.orm import Session

from models.learning import Problem, SkillSnapshot, Submission
from models.users import User

_CORRECT = re.compile(
    r"##\s*Verdict.*?\b(correct|looks good|no changes needed|well done|great job)\b",
    re.IGNORECASE | re.DOTALL,
)
_MINOR = re.compile(
    r"##\s*Verdict.*?\b(minor|small|few issues|mostly correct|almost)\b",
    re.IGNORECASE | re.DOTALL,
)


def _score_from_review(review: str) -> float:
    if _CORRECT.search(review):
        return 1.0
    if _MINOR.search(review):
        return 0.75
    return 0.5


def _xp_for(score: float, hints_used: int, solution_viewed: bool) -> int:
    base = int(100 * score)
    base -= hints_used * 10
    if solution_viewed:
        base -= 50
    return max(5, base)


def assess_submission(
    db: Session,
    submission: Submission,
    problem: Problem,
    user: User,
) -> dict:
    """Score submission, update skill_level + xp, save SkillSnapshot. Returns assessment dict."""
    score = _score_from_review(submission.llm_review or "")
    xp = _xp_for(score, submission.hints_used, submission.solution_viewed)

    # Update per-topic skill confidence
    skill_level: dict = dict(user.skill_level or {})
    for topic in problem.topic or []:
        current = float(skill_level.get(topic, 0.0))
        if score >= 0.9:
            skill_level[topic] = round(min(1.0, current + 0.10), 3)
        elif score >= 0.7:
            skill_level[topic] = round(min(1.0, current + 0.05), 3)
        else:
            skill_level[topic] = round(max(0.0, current - 0.02), 3)

    submission.score = score
    user.skill_level = skill_level
    user.xp_total = (user.xp_total or 0) + xp

    snapshot = SkillSnapshot(
        user_id=user.id,
        snapshot={
            "skill_level": skill_level,
            "xp_earned": xp,
            "score": score,
            "submission_id": str(submission.id),
            "problem_id": str(problem.id),
        },
        trigger="submission",
    )
    db.add(snapshot)
    db.add(submission)
    db.add(user)
    db.commit()

    return {"score": score, "xp_earned": xp, "skill_level": skill_level}
