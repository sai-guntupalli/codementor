"""add_learning_paths_tables

Revision ID: f1a2b3c4d5e6
Revises: 5eff9d6355d1
Create Date: 2026-05-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '5eff9d6355d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create learning_paths and learning_path_problems tables."""
    # Create the enum type
    learningpathtype = postgresql.ENUM('curated', 'personalized', 'custom', name='learningpathtype')
    learningpathtype.create(op.get_bind())

    op.create_table(
        'learning_paths',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column(
            'type',
            sa.Enum('curated', 'personalized', 'custom', name='learningpathtype', create_type=False),
            nullable=False,
        ),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sort_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint(
            "type = 'curated' OR created_by IS NOT NULL",
            name='ck_learning_paths_created_by_required',
        ),
    )

    # Partial unique index: one personalized path per user
    op.create_index(
        'uq_personalized_path_per_user',
        'learning_paths',
        ['created_by'],
        unique=True,
        postgresql_where=sa.text("type = 'personalized'"),
    )

    op.create_table(
        'learning_path_problems',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'learning_path_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('learning_paths.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'problem_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('problems.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('learning_path_id', 'problem_id', name='uq_learning_path_problem'),
    )


def downgrade() -> None:
    """Drop learning_paths and learning_path_problems tables."""
    op.drop_table('learning_path_problems')
    op.drop_index('uq_personalized_path_per_user', table_name='learning_paths')
    op.drop_table('learning_paths')

    # Drop the enum type
    learningpathtype = postgresql.ENUM('curated', 'personalized', 'custom', name='learningpathtype')
    learningpathtype.drop(op.get_bind())
