import uuid

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)  # easy|medium|hard
    language: Mapped[str] = mapped_column(String, nullable=False)  # python|sql
    topic: Mapped[list] = mapped_column(ARRAY(String), default=[])
    examples: Mapped[list] = mapped_column(JSONB, default=[])
    constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    hints: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    external_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # source: curated|user|llm
    source: Mapped[str] = mapped_column(String, nullable=False, default="curated")
    sort_order: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProblemSolution(Base):
    __tablename__ = "problem_solutions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    language: Mapped[str] = mapped_column(String, nullable=False)
    variant: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    time_complexity: Mapped[str | None] = mapped_column(String, nullable=True)
    space_complexity: Mapped[str | None] = mapped_column(String, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False)
    llm_review: Mapped[str | None] = mapped_column(Text, nullable=True)
    improved_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_model_used: Mapped[str | None] = mapped_column(String, nullable=True)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    solution_viewed: Mapped[bool] = mapped_column(Boolean, default=False)
    solution_level: Mapped[str | None] = mapped_column(String, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SkillSnapshot(Base):
    __tablename__ = "skill_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    trigger: Mapped[str] = mapped_column(String, nullable=False)  # submission|manual|scheduled
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProblemBookmark(Base):
    __tablename__ = "problem_bookmarks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        sa.UniqueConstraint("user_id", "problem_id", name="uq_bookmark_user_problem"),
    )
