import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False)  # python|sql
    difficulty: Mapped[str] = mapped_column(String, nullable=False)  # easy|medium|hard
    topic: Mapped[list] = mapped_column(ARRAY(String), default=[])
    examples: Mapped[dict] = mapped_column(JSONB, default={})
    constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    # source: curated|user|llm
    source: Mapped[str] = mapped_column(String, nullable=False, default="curated")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
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
