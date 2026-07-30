import json
import time
import uuid
from sqlalchemy import func
from app.db.db import SessionLocal
from app.db.models import User, Question, Playground, Submission, UserRole, Difficulty
from app.validator.core import validate


def init_db():
    pass


def list_questions():
    db = SessionLocal()
    try:
        rows = db.query(Question).order_by(Question.created_at.desc()).all()
        result = []
        for r in rows:
            created_ts = r.created_at.timestamp() if r.created_at else time.time()
            reviewer_user = db.query(User).filter(User.id == r.reviewer_id).first() if r.reviewer_id else None
            owner_user = db.query(User).filter(User.id == r.owner_id).first() if r.owner_id else None
            creator_user = db.query(User).filter(User.id == r.created_by).first() if r.created_by else None

            result.append({
                "id": str(r.id),
                "title": r.title,
                "question": r.description,
                "created_at": created_ts,
                "created_by": str(r.created_by) if r.created_by else None,
                "creator_email": creator_user.email if creator_user else None,
                "reviewer_id": str(r.reviewer_id) if r.reviewer_id else None,
                "reviewer_email": reviewer_user.email if reviewer_user else None,
                "owner_id": str(r.owner_id) if r.owner_id else None,
                "owner_email": owner_user.email if owner_user else None,
                "is_published": bool(r.is_published),
            })
        return result
    finally:
        db.close()


def get_question(question_id):
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
        solution = sol_pg.diagram_json if sol_pg else {}
        if isinstance(solution, str):
            solution = json.loads(solution)

        created_ts = q.created_at.timestamp() if q.created_at else time.time()
        reviewer_user = db.query(User).filter(User.id == q.reviewer_id).first() if q.reviewer_id else None
        owner_user = db.query(User).filter(User.id == q.owner_id).first() if q.owner_id else None
        creator_user = db.query(User).filter(User.id == q.created_by).first() if q.created_by else None

        return {
            "id": str(q.id),
            "title": q.title,
            "question": q.description,
            "solution": solution,
            "created_at": created_ts,
            "created_by": str(q.created_by) if q.created_by else None,
            "creator_email": creator_user.email if creator_user else None,
            "reviewer_id": str(q.reviewer_id) if q.reviewer_id else None,
            "reviewer_email": reviewer_user.email if reviewer_user else None,
            "owner_id": str(q.owner_id) if q.owner_id else None,
            "owner_email": owner_user.email if owner_user else None,
            "is_published": bool(q.is_published),
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
            q = db.query(Question).filter(Question.id == q_uuid).first()
        except ValueError:
            q = None

        if not q:
            return False
        db.delete(q)
        db.commit()
        return True
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
            q.is_published = is_published

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



