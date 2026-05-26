"""add last practice fields to users

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_practice_problem_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("last_practice_path_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("last_practice_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_last_practice_problem_id",
        "users",
        "problems",
        ["last_practice_problem_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_last_practice_path_id",
        "users",
        "learning_paths",
        ["last_practice_path_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_last_practice_path_id", "users", type_="foreignkey")
    op.drop_constraint("fk_users_last_practice_problem_id", "users", type_="foreignkey")
    op.drop_column("users", "last_practice_at")
    op.drop_column("users", "last_practice_path_id")
    op.drop_column("users", "last_practice_problem_id")
