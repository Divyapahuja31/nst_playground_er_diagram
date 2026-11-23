import json
import time
import uuid
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from app.db.db import SessionLocal
from app.db.models import User, Question, Playground, Submission, UserRole, Difficulty
from app.validator.core import validate


def init_db():
    pass


def list_questions():
    db = SessionLocal()
    try:
        rows = (
            db.query(Question)
            .options(
                joinedload(Question.creator),
                joinedload(Question.reviewer),
                joinedload(Question.owner),
            )
            .order_by(Question.created_at.desc())
            .all()
        )
        result = []
        for r in rows:
            created_ts = r.created_at.timestamp() if r.created_at else time.time()
            result.append({
                "id": str(r.id),
                "title": r.title,
                "question": r.description,
                "difficulty": r.difficulty.value if hasattr(r.difficulty, "value") else str(r.difficulty or "MEDIUM"),
                "created_at": created_ts,
                "created_by": str(r.created_by) if r.created_by else None,
                "creator_email": r.creator.email if r.creator else None,
                "reviewer_id": str(r.reviewer_id) if r.reviewer_id else None,
                "reviewer_email": r.reviewer.email if r.reviewer else None,
                "owner_id": str(r.owner_id) if r.owner_id else None,
                "owner_email": r.owner.email if r.owner else None,
                "is_published": bool(r.is_published),
            })
        return result 
    finally:
        db.close()


def clear_all_questions() -> int:
    """Removes all questions, playgrounds, and submissions from database."""
    db = SessionLocal()
    try:
        db.query(Submission).delete(synchronize_session=False)
        db.query(Playground).delete(synchronize_session=False)
        count = db.query(Question).delete(synchronize_session=False)
        db.commit()
        return count
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_question(question_id):
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
            q = (
                db.query(Question)
                .options(
                    joinedload(Question.creator),
                    joinedload(Question.reviewer),
                    joinedload(Question.owner),
                )
                .filter(Question.id == q_uuid)
                .first()
            )
        except ValueError:
            q = None

        if not q:
            return None

        sol_pg = (
            db.query(Playground)
            .filter(
                Playground.question_id == q.id,
                Playground.is_solution.is_(True),
            )
            .first()
        )
        solution = sol_pg.diagram_json if sol_pg else {}
        if isinstance(solution, str):
            solution = json.loads(solution)

        created_ts = q.created_at.timestamp() if q.created_at else time.time()

        return {
            "id": str(q.id),
            "title": q.title,
            "question": q.description,
            "solution": solution,
            "created_at": created_ts,
            "created_by": str(q.created_by) if q.created_by else None,
            "creator_email": q.creator.email if q.creator else None,
            "reviewer_id": str(q.reviewer_id) if q.reviewer_id else None,
            "reviewer_email": q.reviewer.email if q.reviewer else None,
            "owner_id": str(q.owner_id) if q.owner_id else None,
            "owner_email": q.owner.email if q.owner else None,
            "is_published": bool(q.is_published),
            "has_spec": bool(q.spec_json is not None),
            "spec_json": q.spec_json,
        }
    finally:
        db.close()


def create_question(title: str, question: str, solution, created_by_id=None, reviewer_email=None, owner_email=None, is_published=False):
    db = SessionLocal()
    try:
        reviewer = db.query(User).filter(User.email == reviewer_email).first() if reviewer_email else None
        owner = db.query(User).filter(User.email == owner_email).first() if owner_email else None

        q = Question(
            id=uuid.uuid4(),
            title=title,
            description=question,
            difficulty=Difficulty.MEDIUM,
            created_by=created_by_id,
            reviewer_id=reviewer.id if reviewer else None,
            owner_id=owner.id if owner else None,
            is_published=is_published,
        )
        db.add(q)
        db.commit()
        db.refresh(q)

        if created_by_id:
            pg = Playground(
                id=uuid.uuid4(),
                name=f"{title} Solution",
                owner_id=created_by_id,
                question_id=q.id,
                is_solution=True,
                diagram_json=solution,
            )
            db.add(pg)
            db.commit()

        return str(q.id)
    finally:
        db.close()


def delete_question(question_id) -> bool:
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
        except ValueError:
            return False

        # Direct database deletes without loading ORM models to avoid remote lazy-load roundtrips
        db.query(Submission).filter(Submission.question_id == q_uuid).delete(synchronize_session=False)
        db.query(Playground).filter(Playground.question_id == q_uuid).delete(synchronize_session=False)
        deleted_count = db.query(Question).filter(Question.id == q_uuid).delete(synchronize_session=False)
        db.commit()
        return deleted_count > 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_question(question_id: str, title: str = None, question: str = None, solution = None, reviewer_email=None, owner_email=None, is_published=None) -> bool:
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
            q = db.query(Question).filter(Question.id == q_uuid).first()
        except ValueError:
            q = None

        if not q:
            return False

        if title is not None:
            q.title = title
        if question is not None:
            q.description = question
        if is_published is not None:
            q.is_published = bool(is_published)

        if reviewer_email is not None:
            if reviewer_email == "":
                q.reviewer_id = None
            else:
                reviewer = db.query(User).filter(User.email == reviewer_email).first()
                if reviewer:
                    q.reviewer_id = reviewer.id

        if owner_email is not None:
            if owner_email == "":
                q.owner_id = None
            else:
                owner = db.query(User).filter(User.email == owner_email).first()
                if owner:
                    q.owner_id = owner.id

        if solution is not None:
            sol_pg = (
                db.query(Playground)
                .filter(
                    Playground.question_id == q.id,
                    Playground.is_solution.is_(True),
                )
                .first()
            )
            if sol_pg:
                sol_pg.diagram_json = solution
            else:
                teacher_id = q.created_by
                if teacher_id:
                    pg = Playground(
                        id=uuid.uuid4(),
                        name=f"{q.title} Solution",
                        owner_id=teacher_id,
                        question_id=q.id,
                        is_solution=True,
                        diagram_json=solution,
                    )
                    db.add(pg)

        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ══════════════════════════════════════════
#  Playground Persistent Operations
# ══════════════════════════════════════════

def get_or_create_user_playground(question_id: str, user: User):
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
            q = db.query(Question).filter(Question.id == q_uuid).first()
        except ValueError:
            q = None

        if not q:
            return None

        is_teacher = user.role in (UserRole.TEACHER, UserRole.ADMIN) and (
            str(user.id) == str(q.created_by) or str(user.id) == str(q.owner_id) or user.role == UserRole.ADMIN
        )

        if is_teacher:
            pg = (
                db.query(Playground)
                .filter(Playground.question_id == q.id, Playground.is_solution.is_(True))
                .first()
            )
            if not pg:
                pg = Playground(
                    id=uuid.uuid4(),
                    name=f"{q.title} Solution",
                    owner_id=user.id,
                    question_id=q.id,
                    is_solution=True,
                    diagram_json={},
                )
                db.add(pg)
                db.commit()
                db.refresh(pg)
        else:
            pg = (
                db.query(Playground)
                .filter(
                    Playground.question_id == q.id,
                    Playground.owner_id == user.id,
                    Playground.is_solution.is_(False),
                )
                .first()
            )
            if not pg:
                pg = Playground(
                    id=uuid.uuid4(),
                    name=f"{q.title} Playground",
                    owner_id=user.id,
                    question_id=q.id,
                    is_solution=False,
                    diagram_json={},
                )
                db.add(pg)
                db.commit()
                db.refresh(pg)

        pg.last_opened_at = func.now()
        db.commit()

        return {
            "id": str(pg.id),
            "name": pg.name,
            "question_id": str(pg.question_id),
            "owner_id": str(pg.owner_id),
            "is_solution": bool(pg.is_solution),
            "diagram_json": pg.diagram_json if pg.diagram_json is not None else {},
            "updated_at": pg.updated_at.timestamp() if pg.updated_at else time.time(),
        }
    finally:
        db.close()


def save_user_playground(question_id: str, user: User, diagram_json: dict):
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
            q = db.query(Question).filter(Question.id == q_uuid).first()
        except ValueError:
            q = None

        if not q:
            return None

        is_teacher = user.role in (UserRole.TEACHER, UserRole.ADMIN) and (
            str(user.id) == str(q.created_by) or str(user.id) == str(q.owner_id) or user.role == UserRole.ADMIN
        )

        if is_teacher:
            pg = (
                db.query(Playground)
                .filter(Playground.question_id == q.id, Playground.is_solution.is_(True))
                .first()
            )
        else:
            pg = (
                db.query(Playground)
                .filter(
                    Playground.question_id == q.id,
                    Playground.owner_id == user.id,
                    Playground.is_solution.is_(False),
                )
                .first()
            )

        if not pg:
            pg = Playground(
                id=uuid.uuid4(),
                name=f"{q.title} {'Solution' if is_teacher else 'Playground'}",
                owner_id=user.id,
                question_id=q.id,
                is_solution=is_teacher,
                diagram_json=diagram_json,
            )
            db.add(pg)
        else:
            pg.diagram_json = diagram_json

        pg.last_opened_at = func.now()
        db.commit()
        db.refresh(pg)

        return {
            "id": str(pg.id),
            "question_id": str(pg.question_id),
            "owner_id": str(pg.owner_id),
            "is_solution": bool(pg.is_solution),
            "diagram_json": pg.diagram_json,
            "updated_at": pg.updated_at.timestamp() if pg.updated_at else time.time(),
        }
    finally:
        db.close()


def submit_user_playground(question_id: str, user: User, algorithm: str = None):
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
            q = db.query(Question).filter(Question.id == q_uuid).first()
        except ValueError:
            q = None

        if not q:
            return None, "Question not found"

        # ── Branch A: Query-Based Validation (if question has a spec_json) ──
        if q.spec_json is not None:
            # Load student's saved playground
            stu_pg = (
                db.query(Playground)
                .filter(
                    Playground.question_id == q.id,
                    Playground.owner_id == user.id,
                    Playground.is_solution.is_(False),
                )
                .first()
            )
            if not stu_pg or not stu_pg.diagram_json:
                return None, "No saved student playground diagram found for this question. Save your diagram before submitting."

            from app.query_validator.spec import spec_from_dict
            from app.query_validator.scorer import evaluate_submission

            spec = spec_from_dict(str(q.id), q.spec_json)
            report = evaluate_submission(spec, stu_pg.diagram_json)
            validation_result = report.to_dict()

            score = float(report.total_marks_earned)

            sub = (
                db.query(Submission)
                .filter(Submission.student_id == user.id, Submission.question_id == q.id)
                .first()
            )
            if not sub:
                sub = Submission(
                    id=uuid.uuid4(),
                    student_id=user.id,
                    question_id=q.id,
                    playground_id=stu_pg.id,
                    score=score,
                    feedback_json=validation_result,
                )
                db.add(sub)
            else:
                sub.playground_id = stu_pg.id
                sub.score = score
                sub.feedback_json = validation_result
                sub.submitted_at = func.now()

            db.commit()
            return validation_result, None

        # ── Branch B: Legacy Graph Comparison (Bliss / VF2) ───────────────
        # 1. Load teacher's solution playground
        sol_pg = (
            db.query(Playground)
            .filter(Playground.question_id == q.id, Playground.is_solution.is_(True))
            .first()
        )
        if not sol_pg or not sol_pg.diagram_json:
            return None, "No teacher solution diagram found for this question"

        # 2. Load student's saved playground
        stu_pg = (
            db.query(Playground)
            .filter(
                Playground.question_id == q.id,
                Playground.owner_id == user.id,
                Playground.is_solution.is_(False),
            )
            .first()
        )
        if not stu_pg or not stu_pg.diagram_json:
            return None, "No saved student playground diagram found for this question. Save your diagram before submitting."

        # 3. Run validation against saved diagrams
        validation_result = validate(sol_pg.diagram_json, stu_pg.diagram_json, algorithm)
        validation_result["validation_engine"] = "legacy_bliss"

        # 4. Upsert single submission record for (student_id, question_id)
        names_score = validation_result.get("names", {}).get("score", 0)
        is_valid = validation_result.get("is_valid", False)
        score = 100.0 if is_valid else float(names_score)

        sub = (
            db.query(Submission)
            .filter(Submission.student_id == user.id, Submission.question_id == q.id)
            .first()
        )
        if not sub:
            sub = Submission(
                id=uuid.uuid4(),
                student_id=user.id,
                question_id=q.id,
                playground_id=stu_pg.id,
                score=score,
                feedback_json=validation_result,
            )
            db.add(sub)
        else:
            sub.playground_id = stu_pg.id
            sub.score = score
            sub.feedback_json = validation_result
            sub.submitted_at = func.now()

        db.commit()
        return validation_result, None
    finally:
        db.close()


def get_question_solution_playground(question_id: str):
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
            q = db.query(Question).filter(Question.id == q_uuid).first()
        except ValueError:
            q = None

        if not q:
            return None

        sol_pg = (
            db.query(Playground)
            .filter(
                Playground.question_id == q.id,
                Playground.is_solution.is_(True),
            )
            .first()
        )
        if not sol_pg:
            return None

        return {
            "id": str(sol_pg.id),
            "question_id": str(sol_pg.question_id),
            "owner_id": str(sol_pg.owner_id),
            "is_solution": True,
            "diagram_json": sol_pg.diagram_json or {},
        }
    finally:
        db.close()



