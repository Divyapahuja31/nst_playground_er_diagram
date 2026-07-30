"""rename_workspaces_to_playgrounds

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-30

Renames workspaces table to playgrounds:
- Renames workspaces table to playgrounds
- Renames indexes and FK columns to match playgrounds
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# ── Alembic metadata ────────────────────────────────────────────────────
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Rename table workspaces -> playgrounds
    op.rename_table("workspaces", "playgrounds")

    # 2. Rename indexes
    op.execute("ALTER INDEX ix_workspaces_owner_id RENAME TO ix_playgrounds_owner_id;")
    op.execute("ALTER INDEX ix_workspaces_question_id RENAME TO ix_playgrounds_question_id;")
    op.execute("ALTER INDEX ix_workspaces_is_solution RENAME TO ix_playgrounds_is_solution;")
    op.execute("ALTER INDEX uq_question_solution_workspace RENAME TO uq_question_solution_playground;")
    op.execute("ALTER INDEX uq_student_question_workspace RENAME TO uq_student_question_playground;")

    # 3. Rename submission FK column workspace_id -> playground_id
    op.alter_column("submissions", "workspace_id", new_column_name="playground_id")
    op.execute("ALTER INDEX ix_submissions_workspace_id RENAME TO ix_submissions_playground_id;")

    # 4. Rename trigger
    op.execute("DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON playgrounds;")
    op.execute("""
        CREATE TRIGGER trg_playgrounds_updated_at
        BEFORE UPDATE ON playgrounds
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_playgrounds_updated_at ON playgrounds;")
    op.alter_column("submissions", "playground_id", new_column_name="workspace_id")
    op.execute("ALTER INDEX ix_submissions_playground_id RENAME TO ix_submissions_workspace_id;")

    op.execute("ALTER INDEX ix_playgrounds_owner_id RENAME TO ix_workspaces_owner_id;")
    op.execute("ALTER INDEX ix_playgrounds_question_id RENAME TO ix_workspaces_question_id;")
    op.execute("ALTER INDEX ix_playgrounds_is_solution RENAME TO ix_workspaces_is_solution;")
    op.execute("ALTER INDEX uq_question_solution_playground RENAME TO uq_question_solution_workspace;")
    op.execute("ALTER INDEX uq_student_question_playground RENAME TO uq_student_question_workspace;")

    op.rename_table("playgrounds", "workspaces")
