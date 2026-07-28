"""initial_schema

Creates the full production schema:
  - users
  - questions
  - playgrounds  (with partial unique index for QUESTION_SOLUTION)
  - playground_versions
  - submissions

Revision ID: 0001
Revises    : (none — initial migration)
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# ── Alembic metadata ────────────────────────────────────────────────────
revision: str  = "0001"
down_revision       = None
branch_labels       = None
depends_on          = None


def upgrade() -> None:
    # ── PostgreSQL enum types ────────────────────────────────────────────
    userrole_enum = sa.Enum(
        "STUDENT", "TEACHER", "ADMIN",
        name="userrole",
        create_type=True,
    )
    difficulty_enum = sa.Enum(
        "EASY", "MEDIUM", "HARD",
        name="difficulty",
        create_type=True,
    )
    playgroundtype_enum = sa.Enum(
        "PRACTICE", "QUESTION_SOLUTION", "ASSIGNMENT",
        name="playgroundtype",
        create_type=True,
    )

    # ── users ────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",            UUID(as_uuid=True),  primary_key=True,  server_default=sa.text("gen_random_uuid()")),
        sa.Column("full_name",     sa.String(255),       nullable=False),
        sa.Column("email",         sa.String(255),       nullable=False,    unique=True),
        sa.Column("password_hash", sa.String(255),       nullable=False),
        sa.Column("role",          userrole_enum,         nullable=False,    server_default="STUDENT"),
        sa.Column("is_active",     sa.Boolean(),          nullable=False,    server_default="true"),
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",    sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role",  "users", ["role"])

    # ── questions ────────────────────────────────────────────────────────
    op.create_table(
        "questions",
        sa.Column("id",           UUID(as_uuid=True),  primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title",        sa.String(500),       nullable=False),
        sa.Column("description",  sa.Text(),            nullable=True),
        sa.Column("difficulty",   difficulty_enum,       nullable=False,   server_default="MEDIUM"),
        sa.Column("created_by",   UUID(as_uuid=True),  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_published", sa.Boolean(),          nullable=False,   server_default="false"),
        sa.Column("reviewer_id",  UUID(as_uuid=True),  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("owner_id",     UUID(as_uuid=True),  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── playgrounds ──────────────────────────────────────────────────────
    op.create_table(
        "playgrounds",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name",           sa.String(500),      nullable=False),
        sa.Column("owner_id",       UUID(as_uuid=True), sa.ForeignKey("users.id",     ondelete="CASCADE"),   nullable=False),
        sa.Column("question_id",    UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="SET NULL"),  nullable=True),
        sa.Column("type",           playgroundtype_enum, nullable=False),
        sa.Column("diagram_json",   JSONB,               nullable=True),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",     sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_playgrounds_owner_id",    "playgrounds", ["owner_id"])
    op.create_index("ix_playgrounds_question_id", "playgrounds", ["question_id"])
    op.create_index("ix_playgrounds_type",        "playgrounds", ["type"])
    # Partial unique index: only one QUESTION_SOLUTION playground per question
    op.create_index(
        "uq_question_solution_playground",
        "playgrounds",
        ["question_id"],
        unique=True,
        postgresql_where=sa.text("type = 'QUESTION_SOLUTION'"),
    )

    # ── playground_versions ──────────────────────────────────────────────
    op.create_table(
        "playground_versions",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("playground_id",  UUID(as_uuid=True), sa.ForeignKey("playgrounds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(),        nullable=False),
        sa.Column("diagram_json",   JSONB,               nullable=False),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("playground_id", "version_number", name="uq_playground_version_number"),
    )
    op.create_index("ix_playground_versions_playground_id", "playground_versions", ["playground_id"])

    # ── submissions ──────────────────────────────────────────────────────
    op.create_table(
        "submissions",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_id",     UUID(as_uuid=True), sa.ForeignKey("users.id",      ondelete="SET NULL"), nullable=True),
        sa.Column("question_id",    UUID(as_uuid=True), sa.ForeignKey("questions.id",  ondelete="SET NULL"), nullable=True),
        sa.Column("playground_id",  UUID(as_uuid=True), sa.ForeignKey("playgrounds.id",ondelete="SET NULL"), nullable=True),
        sa.Column("submitted_json", JSONB,               nullable=False),
        sa.Column("score",          sa.Float(),          nullable=True),
        sa.Column("feedback_json",  JSONB,               nullable=True),
        sa.Column("submitted_at",   sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_submissions_student_id",    "submissions", ["student_id"])
    op.create_index("ix_submissions_question_id",   "submissions", ["question_id"])
    op.create_index("ix_submissions_playground_id", "submissions", ["playground_id"])

    # ── updated_at trigger (fires on every UPDATE, server-side) ─────────
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    for tbl in ("users", "questions", "playgrounds"):
        op.execute(f"""
            CREATE TRIGGER trg_{tbl}_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """)


def downgrade() -> None:
    # Drop triggers
    for tbl in ("users", "questions", "playgrounds"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{tbl}_updated_at ON {tbl};")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")

    # Drop tables (reverse dependency order)
    op.drop_table("submissions")
    op.drop_table("playground_versions")
    op.drop_table("playgrounds")
    op.drop_table("questions")
    op.drop_table("users")

    # Drop enum types
    sa.Enum(name="playgroundtype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="difficulty").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="userrole").drop(op.get_bind(), checkfirst=True)
