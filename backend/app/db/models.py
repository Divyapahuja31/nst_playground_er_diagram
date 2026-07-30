"""
Production SQLAlchemy 2.0 database models.

Tables
------
  User        — platform users (students, teachers, admins)
  Question    — problem statements created by teachers
  Workspace   — ER diagram workspaces (official solution or student assignment)
  Submission  — single latest submission per student per question
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
    questions   = relationship("Question",   back_populates="creator", foreign_keys="Question.created_by")
    workspaces  = relationship("Workspace",  back_populates="owner",   foreign_keys="Workspace.owner_id")
    submissions = relationship("Submission", back_populates="student", foreign_keys="Submission.student_id")

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
    creator     = relationship("User",       back_populates="questions", foreign_keys=[created_by])
    reviewer    = relationship("User",       foreign_keys=[reviewer_id])
    owner       = relationship("User",       foreign_keys=[owner_id])
    workspaces  = relationship("Workspace",  back_populates="question",  cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="question",  cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Question id={self.id} title={self.title!r}>"


# ══════════════════════════════════════════
#  Workspace
# ══════════════════════════════════════════

class Workspace(Base):
    """
    Represents an ER diagram workspace.
    Every workspace belongs to exactly one question and one owner.

    Owner types:
    - Teacher: is_solution = True (official solution workspace)
    - Student: is_solution = False (assignment workspace)
    """

    __tablename__ = "workspaces"

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
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_solution    = Column(Boolean, nullable=False, default=False, server_default="false")
    diagram_json   = Column(JSONB, nullable=True)
    last_opened_at = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # ── Relationships ────────────────────
    owner       = relationship("User",       back_populates="workspaces",  foreign_keys=[owner_id])
    question    = relationship("Question",   back_populates="workspaces")
    submissions = relationship("Submission", back_populates="workspace")

    __table_args__ = (
        Index("ix_workspaces_owner_id",    "owner_id"),
        Index("ix_workspaces_question_id", "question_id"),
        Index("ix_workspaces_is_solution", "is_solution"),
        # Enforce exactly ONE solution workspace per question
        Index(
            "uq_question_solution_workspace",
            "question_id",
            unique=True,
            postgresql_where=text("is_solution = true"),
        ),
        # Enforce max ONE student workspace per student per question
        Index(
            "uq_student_question_workspace",
            "question_id",
            "owner_id",
            unique=True,
            postgresql_where=text("is_solution = false"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Workspace id={self.id} is_solution={self.is_solution} owner_id={self.owner_id}>"


# ══════════════════════════════════════════
#  Submission
# ══════════════════════════════════════════

class Submission(Base):
    """
    Stores the single latest submission per student per question.
    Submitting again updates the existing record.
    """

    __tablename__ = "submissions"

    id            = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    student_id    = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id   = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    workspace_id  = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="SET NULL"),
        nullable=True,
    )
    score         = Column(Float, nullable=True)          # 0-100 score
    feedback_json = Column(JSONB, nullable=True)          # diagnostic feedback
    submitted_at  = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # ── Relationships ────────────────────
    student   = relationship("User",      back_populates="submissions", foreign_keys=[student_id])
    question  = relationship("Question",  back_populates="submissions")
    workspace = relationship("Workspace", back_populates="submissions")

    __table_args__ = (
        Index("ix_submissions_student_id",   "student_id"),
        Index("ix_submissions_question_id",  "question_id"),
        Index("ix_submissions_workspace_id", "workspace_id"),
        # Enforce ONE submission per student per question
        UniqueConstraint("student_id", "question_id", name="uq_submission_student_question"),
    )

    def __repr__(self) -> str:
        return f"<Submission id={self.id} student_id={self.student_id} score={self.score}>"
