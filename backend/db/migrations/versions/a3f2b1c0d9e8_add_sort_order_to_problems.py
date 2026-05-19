"""add_sort_order_to_problems

Revision ID: a3f2b1c0d9e8
Revises: 120665ea30e7
Create Date: 2026-05-18 20:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3f2b1c0d9e8"
down_revision: Union[str, Sequence[str], None] = "120665ea30e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("problems", sa.Column("sort_order", sa.Integer(), nullable=True))
    op.create_index("ix_problems_sort_order", "problems", ["sort_order"])
    # Backfill existing LeetCode problems: sort_order = 1000 + external_id
    op.execute(
        "UPDATE problems SET sort_order = 1000 + external_id WHERE external_id IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_problems_sort_order", table_name="problems")
    op.drop_column("problems", "sort_order")
