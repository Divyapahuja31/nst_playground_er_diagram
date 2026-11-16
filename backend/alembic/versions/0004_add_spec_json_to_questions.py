"""add_spec_json_to_questions

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-15

Adds spec_json JSONB column to questions table for the query-based
validation engine (Phase 1).  The column is nullable so all existing
questions remain valid after the migration.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# ── Alembic metadata ────────────────────────────────────────────────────
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column("spec_json", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("questions", "spec_json")
