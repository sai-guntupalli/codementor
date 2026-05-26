import uuid

from pydantic import BaseModel

from schemas.learning_path import LearningPathOut, LearningPathProblemItem
from schemas.submission import SubmissionHistoryItem
from schemas.user import UserOut


class DashboardOut(BaseModel):
    user: UserOut
    recent_submissions: list[SubmissionHistoryItem]
    learning_paths: list[LearningPathOut]
    active_path_id: uuid.UUID | None
    active_path_problems: list[LearningPathProblemItem]
    solved_count: int
    library_total: int
