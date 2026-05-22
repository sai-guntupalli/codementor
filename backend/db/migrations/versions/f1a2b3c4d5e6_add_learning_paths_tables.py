"""add_learning_paths_tables

Revision ID: f1a2b3c4d5e6
Revises: b7c3d4e5f6a7
Create Date: 2026-05-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'b7c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create learning_paths and learning_path_problems tables."""
    # Use raw SQL to avoid SQLAlchemy auto-creating the enum type
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learningpathtype') THEN
                CREATE TYPE learningpathtype AS ENUM ('curated', 'personalized', 'custom');
            END IF;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS learning_paths (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR NOT NULL,
            description VARCHAR,
            type learningpathtype NOT NULL,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            is_public BOOLEAN NOT NULL DEFAULT false,
            sort_order INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ck_learning_paths_created_by_required
                CHECK (type = 'curated' OR created_by IS NOT NULL)
        );
    """)

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_personalized_path_per_user
        ON learning_paths (created_by)
        WHERE type = 'personalized';
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS learning_path_problems (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
            problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
            added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_learning_path_problem UNIQUE (learning_path_id, problem_id)
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_learning_path_problems_learning_path_id
        ON learning_path_problems (learning_path_id);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_learning_path_problems_problem_id
        ON learning_path_problems (problem_id);
    """)


def downgrade() -> None:
    """Drop learning_paths and learning_path_problems tables."""
    op.execute("DROP TABLE IF EXISTS learning_path_problems;")
    op.execute("DROP INDEX IF EXISTS uq_personalized_path_per_user;")
    op.execute("DROP TABLE IF EXISTS learning_paths;")
    op.execute("DROP TYPE IF EXISTS learningpathtype;")
