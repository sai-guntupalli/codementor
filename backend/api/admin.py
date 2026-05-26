"""Admin-only platform metrics."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.deps import require_admin
from db.session import get_db
from llm.quota import _period_start, _resets_at
from llm.usage_stats import get_admin_usage
from models.users import User
from schemas.usage import AdminUsageOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/usage", response_model=AdminUsageOut)
def admin_usage(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
) -> AdminUsageOut:
    """Aggregate LLM usage for operators (current UTC month by default)."""
    period_start = _period_start()
    period_end = _resets_at()
    start = from_date if from_date is not None else period_start
    end = to_date if to_date is not None else period_end
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return get_admin_usage(db, from_date=start, to_date=end)
