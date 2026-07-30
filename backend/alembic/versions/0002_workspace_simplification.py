"""workspace_simplification

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-28

Refactors data model around question-based workspaces:
- Drops playground_versions table (no version history)
- Replaces playgrounds table with workspaces table (boolean is_solution)
- Adds unique index uq_question_solution_workspace (1 solution workspace per question)
- Adds unique index uq_student_question_workspace (1 student workspace per student per question)
- Refactors submissions table with uq_submission_student_question (1 submission per student per question)
- Drops PlaygroundType enum
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# ── Alembic metadata ────────────────────────────────────────────────────
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Drop existing submission & playground tables ──────────────────
    op.execute("DROP TRIGGER IF EXISTS trg_playgrounds_updated_at ON playgrounds;")
    op.drop_table("submissions")
    op.drop_table("playground_versions")
    op.drop_table("playgrounds")

    # Drop old enum type if present
    op.execute("DROP TYPE IF EXISTS playgroundtype;")

    # ── 2. Create workspaces table ───────────────────────────────────────
    op.create_table(
        "workspaces",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name",           sa.String(500),      nullable=False),
        sa.Column("owner_id",       UUID(as_uuid=True), sa.ForeignKey("users.id",     ondelete="CASCADE"), nullable=False),
        sa.Column("question_id",    UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_solution",    sa.Boolean(),        nullable=False, server_default="false"),
        sa.Column("diagram_json",   JSONB,               nullable=True),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",     sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_workspaces_owner_id",    "workspaces", ["owner_id"])
    op.create_index("ix_workspaces_question_id", "workspaces", ["question_id"])
    op.create_index("ix_workspaces_is_solution", "workspaces", ["is_solution"])

    # Partial unique index: max ONE official solution workspace per question
    op.create_index(
        "uq_question_solution_workspace",
        "workspaces",
        ["question_id"],
        unique=True,
        postgresql_where=sa.text("is_solution = true"),
    )

    # Partial unique index: max ONE student workspace per student per question
    op.create_index(
        "uq_student_question_workspace",
        "workspaces",
        ["question_id", "owner_id"],
        unique=True,
        postgresql_where=sa.text("is_solution = false"),
    )

    # ── 3. Create submissions table ───────────────────────────────────────
    op.create_table(
        "submissions",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_id",     UUID(as_uuid=True), sa.ForeignKey("users.id",      ondelete="CASCADE"),  nullable=False),
        sa.Column("question_id",    UUID(as_uuid=True), sa.ForeignKey("questions.id",  ondelete="CASCADE"),  nullable=False),
        sa.Column("workspace_id",   UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True),
        sa.Column("score",          sa.Float(),          nullable=True),
        sa.Column("feedback_json",  JSONB,               nullable=True),
        sa.Column("submitted_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("student_id", "question_id", name="uq_submission_student_question"),
    )
    op.create_index("ix_submissions_student_id",   "submissions", ["student_id"])
    op.create_index("ix_submissions_question_id",  "submissions", ["question_id"])
    op.create_index("ix_submissions_workspace_id", "submissions", ["workspace_id"])

    # ── 4. Add updated_at trigger for workspaces ────────────────────────
    op.execute("""
        CREATE TRIGGER trg_workspaces_updated_at
        BEFORE UPDATE ON workspaces
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON workspaces;")
    op.drop_table("submissions")
    op.drop_table("workspaces")

    # Re-create old schema elements if downgraded
    playgroundtype_enum = sa.Enum("PRACTICE", "QUESTION_SOLUTION", "ASSIGNMENT", name="playgroundtype")
    playgroundtype_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "playgrounds",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", playgroundtype_enum, nullable=False),
        sa.Column("diagram_json", JSONB, nullable=True),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_playgrounds_owner_id", "playgrounds", ["owner_id"])
    op.create_index("ix_playgrounds_question_id", "playgrounds", ["question_id"])
    op.create_index("ix_playgrounds_type", "playgrounds", ["type"])

    op.create_table(
        "playground_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("playground_id", UUID(as_uuid=True), sa.ForeignKey("playgrounds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("diagram_json", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("playground_id", "version_number", name="uq_playground_version_number"),
    )

    op.create_table(
        "submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("question_id", UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("playground_id", UUID(as_uuid=True), sa.ForeignKey("playgrounds.id", ondelete="SET NULL"), nullable=True),
        sa.Column("submitted_json", JSONB, nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("feedback_json", JSONB, nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
