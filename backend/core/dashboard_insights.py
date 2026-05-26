"""Aggregations for the home dashboard."""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from core.problem_titles import strip_curriculum_prefix
from models.learning import LearningPathProblem, Problem, ProblemBookmark, Submission
from models.users import User
from schemas.dashboard import (
    BookmarkSummaryOut,
    DailyChallengeOut,
    DailyGoalOut,
    LastSessionOut,
    PathCompletionOut,
    SuggestedPathOut,
    WeakTopicOut,
    WeakTopicProblemOut,
    WeekStatsOut,
)
from schemas.learning_path import LearningPathOut, LearningPathProblemItem


BEGINNER_PATH_TITLE = "Python Basics"
DAILY_GOAL_TARGET = 1
WEAK_SKILL_THRESHOLD = 0.35
WEAK_TOPIC_LIMIT = 3
WEAK_PROBLEMS_PER_TOPIC = 3


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _week_bounds(now: datetime) -> tuple[datetime, datetime, datetime]:
    """Return (this_week_start, last_week_start, last_week_end)."""
    today = now.date()
    this_week_start = datetime.combine(
        today - timedelta(days=today.weekday()), datetime.min.time(), tzinfo=UTC
    )
    last_week_start = this_week_start - timedelta(days=7)
    return this_week_start, last_week_start, this_week_start


def _solved_today_count(db: Session, user_id: uuid.UUID) -> int:
    start = datetime.combine(date.today(), datetime.min.time(), tzinfo=UTC)
    return (
        db.query(func.count(Submission.id))
        .filter(
            Submission.user_id == user_id,
            Submission.score.isnot(None),
            Submission.created_at >= start,
        )
        .scalar()
        or 0
    )


def build_daily_goal(db: Session, user_id: uuid.UUID) -> DailyGoalOut:
    solved_today = _solved_today_count(db, user_id)
    return DailyGoalOut(
        target=DAILY_GOAL_TARGET,
        solved_today=solved_today,
        met=solved_today >= DAILY_GOAL_TARGET,
    )


def _deterministic_index(seed: str, size: int) -> int:
    if size <= 0:
        return 0
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return int(digest[:8], 16) % size


def build_daily_challenge(
    db: Session,
    user: User,
    *,
    active_path_id: uuid.UUID | None,
    active_problems: list[LearningPathProblemItem],
    solved_ids: set[uuid.UUID],
) -> DailyChallengeOut | None:
    today_key = f"{user.id}:{date.today().isoformat()}"
    candidates: list[LearningPathProblemItem] = [
        p for p in active_problems if p.id not in solved_ids
    ]

    if not candidates and active_path_id:
        candidates = list(active_problems)

    if not candidates:
        rows = (
            db.query(Problem)
            .filter(Problem.is_published.is_(True), Problem.language == "python")
            .order_by(Problem.sort_order.asc().nullslast(), Problem.title)
            .limit(200)
            .all()
        )
        pool = [p for p in rows if p.id not in solved_ids] or rows
        if not pool:
            return None
        pick = pool[_deterministic_index(today_key, len(pool))]
        completed = pick.id in solved_ids or _problem_solved_today(db, user.id, pick.id)
        return DailyChallengeOut(
            problem_id=pick.id,
            problem_title=strip_curriculum_prefix(pick.title),
            difficulty=pick.difficulty,
            language=pick.language,
            path_id=active_path_id,
            completed_today=completed,
        )

    pick = candidates[_deterministic_index(today_key, len(candidates))]
    completed = pick.solved or _problem_solved_today(db, user.id, pick.id)
    return DailyChallengeOut(
        problem_id=pick.id,
        problem_title=pick.title,
        difficulty=pick.difficulty,
        language=pick.language,
        path_id=active_path_id,
        completed_today=completed,
    )


def _problem_solved_today(db: Session, user_id: uuid.UUID, problem_id: uuid.UUID) -> bool:
    start = datetime.combine(date.today(), datetime.min.time(), tzinfo=UTC)
    row = (
        db.query(Submission.id)
        .filter(
            Submission.user_id == user_id,
            Submission.problem_id == problem_id,
            Submission.score.isnot(None),
            Submission.created_at >= start,
        )
        .first()
    )
    return row is not None


def build_weak_topics(
    db: Session,
    user: User,
    *,
    solved_ids: set[uuid.UUID],
) -> list[WeakTopicOut]:
    skill = user.skill_level or {}
    if not skill:
        return []

    ranked = sorted(
        ((topic, float(level)) for topic, level in skill.items()),
        key=lambda x: x[1],
    )
    weak = [(t, lvl) for t, lvl in ranked if lvl < WEAK_SKILL_THRESHOLD][:WEAK_TOPIC_LIMIT]
    if not weak and ranked:
        weak = ranked[:WEAK_TOPIC_LIMIT]

    results: list[WeakTopicOut] = []
    for topic, level in weak:
        problems = (
            db.query(Problem)
            .filter(
                Problem.is_published.is_(True),
                Problem.topic.overlap([topic]),
            )
            .order_by(Problem.difficulty, Problem.title)
            .limit(30)
            .all()
        )
        unsolved = [p for p in problems if p.id not in solved_ids][:WEAK_PROBLEMS_PER_TOPIC]
        pool = unsolved or problems[:WEAK_PROBLEMS_PER_TOPIC]
        if not pool:
            continue
        results.append(
            WeakTopicOut(
                topic=topic.replace("-", " ").title(),
                skill=round(level, 2),
                problems=[
                    WeakTopicProblemOut(
                        id=p.id,
                        title=strip_curriculum_prefix(p.title),
                        difficulty=p.difficulty,
                    )
                    for p in pool
                ],
            )
        )
    return results


def build_bookmarks(db: Session, user_id: uuid.UUID, *, limit: int = 5) -> list[BookmarkSummaryOut]:
    rows = (
        db.query(ProblemBookmark, Problem)
        .join(Problem, ProblemBookmark.problem_id == Problem.id)
        .filter(ProblemBookmark.user_id == user_id)
        .order_by(ProblemBookmark.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        BookmarkSummaryOut(
            problem_id=p.id,
            title=strip_curriculum_prefix(p.title),
            difficulty=p.difficulty,
            language=p.language,
        )
        for _, p in rows
    ]


def build_week_stats(db: Session, user: User) -> WeekStatsOut:
    now = _utc_now()
    this_week_start, last_week_start, last_week_end = _week_bounds(now)

    def _count_solved(since: datetime, until: datetime | None = None) -> int:
        q = db.query(func.count(func.distinct(Submission.problem_id))).filter(
            Submission.user_id == user.id,
            Submission.score.isnot(None),
            Submission.created_at >= since,
        )
        if until is not None:
            q = q.filter(Submission.created_at < until)
        return q.scalar() or 0

    def _count_submissions(since: datetime, until: datetime | None = None) -> int:
        q = db.query(func.count(Submission.id)).filter(
            Submission.user_id == user.id,
            Submission.created_at >= since,
        )
        if until is not None:
            q = q.filter(Submission.created_at < until)
        return q.scalar() or 0

    return WeekStatsOut(
        solved_this_week=_count_solved(this_week_start),
        solved_last_week=_count_solved(last_week_start, last_week_end),
        submissions_this_week=_count_submissions(this_week_start),
        submissions_last_week=_count_submissions(last_week_start, last_week_end),
        xp_total=user.xp_total or 0,
    )


def build_last_session(
    db: Session,
    user: User,
    *,
    active_path_id: uuid.UUID | None,
) -> LastSessionOut | None:
    if user.last_practice_problem_id:
        problem = db.query(Problem).filter(Problem.id == user.last_practice_problem_id).first()
        if problem:
            return LastSessionOut(
                problem_id=problem.id,
                problem_title=strip_curriculum_prefix(problem.title),
                path_id=user.last_practice_path_id or active_path_id,
                updated_at=user.last_practice_at or _utc_now(),
            )

    row = (
        db.query(Submission, Problem.title)
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(Submission.user_id == user.id)
        .order_by(Submission.created_at.desc())
        .first()
    )
    if not row:
        return None
    sub, title = row
    path_id = user.last_practice_path_id or active_path_id
    if path_id:
        in_path = (
            db.query(LearningPathProblem.id)
            .filter(
                LearningPathProblem.learning_path_id == path_id,
                LearningPathProblem.problem_id == sub.problem_id,
            )
            .first()
        )
        if not in_path:
            path_id = _path_for_problem(db, sub.problem_id)
    else:
        path_id = _path_for_problem(db, sub.problem_id)

    return LastSessionOut(
        problem_id=sub.problem_id,
        problem_title=strip_curriculum_prefix(title),
        path_id=path_id,
        updated_at=sub.created_at,
    )


def _path_for_problem(db: Session, problem_id: uuid.UUID) -> uuid.UUID | None:
    row = (
        db.query(LearningPathProblem.learning_path_id)
        .filter(LearningPathProblem.problem_id == problem_id)
        .first()
    )
    return row[0] if row else None


def record_last_practice(
    db: Session,
    user: User,
    *,
    problem_id: uuid.UUID,
    path_id: uuid.UUID | None = None,
) -> None:
    user.last_practice_problem_id = problem_id
    user.last_practice_path_id = path_id
    user.last_practice_at = _utc_now()
    db.commit()


def build_path_completion(
    active: LearningPathOut | None,
    *,
    solved_today: int,
) -> PathCompletionOut | None:
    if not active:
        return None
    if active.progress.total_count == 0:
        return None
    if active.progress.progress_pct < 100:
        return None
    return PathCompletionOut(
        path_id=active.id,
        path_title=active.title,
        total_count=active.progress.total_count,
        show_celebration=solved_today > 0,
    )


def build_suggested_path(
    paths: list[LearningPathOut],
    *,
    has_focus: bool,
    paths_started_count: int,
) -> SuggestedPathOut | None:
    if has_focus or paths_started_count > 2:
        return None
    basics = next((p for p in paths if p.title == BEGINNER_PATH_TITLE), None)
    if basics and basics.progress.total_count > 0:
        if basics.progress.progress_pct == 0:
            return SuggestedPathOut(
                path_id=basics.id,
                title=basics.title,
                description=basics.description,
                reason="New here? Start with variables, printing, and your first programs.",
            )
    if paths_started_count == 0:
        first_curated = next(
            (p for p in paths if p.type == "curated" and p.progress.total_count > 0),
            None,
        )
        if first_curated:
            return SuggestedPathOut(
                path_id=first_curated.id,
                title=first_curated.title,
                description=first_curated.description,
                reason="Pick a curated track to structure your practice.",
            )
    return None


def count_paths_started(paths: list[LearningPathOut]) -> int:
    return sum(1 for p in paths if p.progress.progress_pct > 0)
