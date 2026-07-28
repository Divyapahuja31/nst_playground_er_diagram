import json
import time
import uuid
from pathlib import Path
from app.db.db import SessionLocal
from app.db.models import User, Question, Playground, UserRole, Difficulty, PlaygroundType


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
                Playground.type == PlaygroundType.QUESTION_SOLUTION,
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
                type=PlaygroundType.QUESTION_SOLUTION,
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

        # Update solution playground if solution is provided
        if solution is not None:
            sol_pg = (
                db.query(Playground)
                .filter(
                    Playground.question_id == q.id,
                    Playground.type == PlaygroundType.QUESTION_SOLUTION,
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
                        type=PlaygroundType.QUESTION_SOLUTION,
                        diagram_json=solution,
                    )
                    db.add(pg)

        db.commit()
        return True
    finally:
        db.close()
