"""llm_usage_guardrails

Revision ID: c1d2e3f4a5b6
Revises: f1a2b3c4d5e6
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add LLM usage tracking columns to usage_events and prompts."""
    # usage_events: add problem_id (FK to problems), input_tokens, output_tokens
    op.add_column(
        'usage_events',
        sa.Column('problem_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_usage_events_problem_id',
        'usage_events',
        'problems',
        ['problem_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.add_column(
        'usage_events',
        sa.Column('input_tokens', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column(
        'usage_events',
        sa.Column('output_tokens', sa.Integer(), nullable=False, server_default='0'),
    )

    # prompts: add max_tokens (nullable — NULL means use OpenRouter default)
    op.add_column(
        'prompts',
        sa.Column('max_tokens', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Remove LLM usage tracking columns from usage_events and prompts."""
    op.drop_column('prompts', 'max_tokens')

    op.drop_column('usage_events', 'output_tokens')
    op.drop_column('usage_events', 'input_tokens')
    op.drop_constraint('fk_usage_events_problem_id', 'usage_events', type_='foreignkey')
    op.drop_column('usage_events', 'problem_id')
