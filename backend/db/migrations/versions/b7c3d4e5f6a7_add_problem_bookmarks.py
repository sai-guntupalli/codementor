"""add problem_bookmarks table"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b7c3d4e5f6a7"
down_revision = "5eff9d6355d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "problem_bookmarks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "problem_id", name="uq_bookmark_user_problem"),
    )
    op.create_index("ix_problem_bookmarks_user_id", "problem_bookmarks", ["user_id"])
    op.create_index("ix_problem_bookmarks_problem_id", "problem_bookmarks", ["problem_id"])


def downgrade() -> None:
    op.drop_index("ix_problem_bookmarks_problem_id", table_name="problem_bookmarks")
    op.drop_index("ix_problem_bookmarks_user_id", table_name="problem_bookmarks")
    op.drop_table("problem_bookmarks")
