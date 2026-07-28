"""
Production SQLAlchemy 2.0 database models.

Tables
------
  User              — platform users (students, teachers, admins)
  Question          — problem statements created by teachers
  Playground        — every ER diagram ever drawn (practice / solution / assignment)
  PlaygroundVersion — immutable snapshots of a playground
  Submission        — frozen snapshot submitted by a student for grading

Enums
-----
  UserRole        : STUDENT | TEACHER | ADMIN
  Difficulty      : EASY | MEDIUM | HARD
  PlaygroundType  : PRACTICE | QUESTION_SOLUTION | ASSIGNMENT
"""

import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from app.db.db import Base


# ══════════════════════════════════════════
#  Enums
# ══════════════════════════════════════════

class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    ADMIN   = "ADMIN"


class Difficulty(str, enum.Enum):
    EASY   = "EASY"
    MEDIUM = "MEDIUM"
    HARD   = "HARD"


class PlaygroundType(str, enum.Enum):
    PRACTICE          = "PRACTICE"
    QUESTION_SOLUTION = "QUESTION_SOLUTION"
    ASSIGNMENT        = "ASSIGNMENT"


# ══════════════════════════════════════════
#  User
# ══════════════════════════════════════════

class User(Base):
    """Platform user. One user can be a student, teacher, or admin."""

    __tablename__ = "users"

    id            = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    full_name     = Column(String(255), nullable=False)
    email         = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(
        Enum(UserRole, name="userrole", create_type=True),
        nullable=False,
        default=UserRole.STUDENT,
        server_default=UserRole.STUDENT.value,
    )
    is_active     = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at    = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # ── Relationships ────────────────────
    questions   = relationship("Question",    back_populates="creator",  foreign_keys="Question.created_by")
    playgrounds = relationship("Playground",  back_populates="owner",    foreign_keys="Playground.owner_id")
    submissions = relationship("Submission",  back_populates="student",  foreign_keys="Submission.student_id")

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_role",  "role"),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


# ══════════════════════════════════════════
#  Question
# ══════════════════════════════════════════

class Question(Base):
    """A graded ER-diagram problem created by a teacher."""

    __tablename__ = "questions"

    id           = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    title        = Column(String(500), nullable=False)
    description  = Column(Text, nullable=True)          # Markdown body
    difficulty   = Column(
        Enum(Difficulty, name="difficulty", create_type=True),
        nullable=False,
        default=Difficulty.MEDIUM,
        server_default=Difficulty.MEDIUM.value,
    )
    created_by   = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewer_id  = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    owner_id     = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at   = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # ── Relationships ────────────────────
    creator     = relationship("User",        back_populates="questions",  foreign_keys=[created_by])
    reviewer    = relationship("User",        foreign_keys=[reviewer_id])
    owner       = relationship("User",        foreign_keys=[owner_id])
    playgrounds = relationship("Playground",  back_populates="question")
    submissions = relationship("Submission",  back_populates="question")

    def __repr__(self) -> str:
        return f"<Question id={self.id} title={self.title!r}>"


# ══════════════════════════════════════════
#  Playground
# ══════════════════════════════════════════

class Playground(Base):
    """
    Core table — every ER diagram is a Playground.

    Business rules
    ──────────────
    • PRACTICE       — must NOT reference a question  (question_id = NULL)
    • QUESTION_SOLUTION — belongs to exactly ONE question; enforced by the
                       partial unique index  uq_question_solution_playground
    • ASSIGNMENT     — belongs to one student (owner_id) and one question
    """

    __tablename__ = "playgrounds"

    id             = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name           = Column(String(500), nullable=False)
    owner_id       = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id    = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
    )
    type           = Column(
        Enum(PlaygroundType, name="playgroundtype", create_type=True),
        nullable=False,
    )
    diagram_json   = Column(JSONB, nullable=True)
    last_opened_at = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # ── Relationships ────────────────────
    owner       = relationship("User",              back_populates="playgrounds", foreign_keys=[owner_id])
    question    = relationship("Question",          back_populates="playgrounds")
    versions    = relationship("PlaygroundVersion", back_populates="playground",  cascade="all, delete-orphan")
    submissions = relationship("Submission",        back_populates="playground")

    __table_args__ = (
        Index("ix_playgrounds_owner_id",    "owner_id"),
        Index("ix_playgrounds_question_id", "question_id"),
        Index("ix_playgrounds_type",        "type"),
        # Partial unique index: only one QUESTION_SOLUTION playground allowed per question.
        # Enforced at the PostgreSQL level — cannot be replicated in SQLite.
        Index(
            "uq_question_solution_playground",
            "question_id",
            unique=True,
            postgresql_where=text("type = 'QUESTION_SOLUTION'"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Playground id={self.id} type={self.type} owner_id={self.owner_id}>"


# ══════════════════════════════════════════
#  PlaygroundVersion
# ══════════════════════════════════════════

class PlaygroundVersion(Base):
    """
    Immutable snapshot of a Playground at a point in time.

    Rows are append-only — never updated or deleted (except via cascade
    when the parent Playground is deleted).
    """

    __tablename__ = "playground_versions"

    id             = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    playground_id  = Column(
        UUID(as_uuid=True),
        ForeignKey("playgrounds.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number = Column(Integer, nullable=False)
    diagram_json   = Column(JSONB, nullable=False)
    created_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # ── Relationships ────────────────────
    playground = relationship("Playground", back_populates="versions")

    __table_args__ = (
        Index("ix_playground_versions_playground_id", "playground_id"),
        # version_number is unique per playground
        UniqueConstraint("playground_id", "version_number", name="uq_playground_version_number"),
    )

    def __repr__(self) -> str:
        return f"<PlaygroundVersion playground_id={self.playground_id} v={self.version_number}>"


# ══════════════════════════════════════════
#  Submission
# ══════════════════════════════════════════

class Submission(Base):
    """
    Frozen snapshot of a student's playground submitted for grading.

    submitted_json is a copy of diagram_json at submission time.
    Future edits to the Playground never affect a Submission.
    """

    __tablename__ = "submissions"

    id             = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    student_id     = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    question_id    = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
    )
    playground_id  = Column(
        UUID(as_uuid=True),
        ForeignKey("playgrounds.id", ondelete="SET NULL"),
        nullable=True,
    )
    submitted_json = Column(JSONB, nullable=False)          # frozen copy of diagram_json
    score          = Column(Float,  nullable=True)           # 0-100 from validator
    feedback_json  = Column(JSONB,  nullable=True)           # full validate() response
    submitted_at   = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # ── Relationships ────────────────────
    student    = relationship("User",       back_populates="submissions", foreign_keys=[student_id])
    question   = relationship("Question",   back_populates="submissions")
    playground = relationship("Playground", back_populates="submissions")

    __table_args__ = (
        Index("ix_submissions_student_id",    "student_id"),
        Index("ix_submissions_question_id",   "question_id"),
        Index("ix_submissions_playground_id", "playground_id"),
    )

    def __repr__(self) -> str:
        return f"<Submission id={self.id} student_id={self.student_id} score={self.score}>"
