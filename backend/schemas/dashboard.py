import uuid
from datetime import datetime

from pydantic import BaseModel

from schemas.learning_path import LearningPathOut, LearningPathProblemItem
from schemas.submission import SubmissionHistoryItem
from schemas.usage import UsageOut
from schemas.user import UserOut


class DailyChallengeOut(BaseModel):
    problem_id: uuid.UUID
    problem_title: str
    difficulty: str
    language: str
    path_id: uuid.UUID | None = None
    completed_today: bool = False


class DailyGoalOut(BaseModel):
    target: int
    solved_today: int
    met: bool


class WeakTopicProblemOut(BaseModel):
    id: uuid.UUID
    title: str
    difficulty: str


class WeakTopicOut(BaseModel):
    topic: str
    skill: float
    problems: list[WeakTopicProblemOut]


class BookmarkSummaryOut(BaseModel):
    problem_id: uuid.UUID
    title: str
    difficulty: str
    language: str


class WeekStatsOut(BaseModel):
    solved_this_week: int
    solved_last_week: int
    submissions_this_week: int
    submissions_last_week: int
    xp_total: int


class LastSessionOut(BaseModel):
    problem_id: uuid.UUID
    problem_title: str
    path_id: uuid.UUID | None = None
    updated_at: datetime


class PathCompletionOut(BaseModel):
    path_id: uuid.UUID
    path_title: str
    total_count: int
    show_celebration: bool


class SuggestedPathOut(BaseModel):
    path_id: uuid.UUID
    title: str
    description: str | None
    reason: str


class DashboardOut(BaseModel):
    user: UserOut
    recent_submissions: list[SubmissionHistoryItem]
    learning_paths: list[LearningPathOut]
    active_path_id: uuid.UUID | None
    active_path_problems: list[LearningPathProblemItem]
    solved_count: int
    library_total: int
    usage: UsageOut
    daily_challenge: DailyChallengeOut | None
    daily_goal: DailyGoalOut
    weak_topics: list[WeakTopicOut]
    bookmarks: list[BookmarkSummaryOut]
    week_stats: WeekStatsOut
    last_session: LastSessionOut | None
    path_completion: PathCompletionOut | None
    suggested_path: SuggestedPathOut | None
    paths_started_count: int
    has_any_submission: bool
