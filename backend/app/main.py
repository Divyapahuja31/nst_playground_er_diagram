from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.db import store
from app.validator.core import validate
from app.validator.engine.base import EngineError
from app.validator.name_matcher import DEFAULT_SIMILARITY_THRESHOLD, compare_entities
from app.validator.schema import SchemaError

from app.modules.auth.router import router as auth_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.on_event("startup")

def on_startup():
    store.init_db()

@app.get('/health')
def health():
    return {"okay": True}

@app.post('/validate')
def validate_endpoint(payload: dict = Body(...)):
    expected_solution = payload.get('expected_solution')
    student_solution = payload.get('student_solution')
    if expected_solution is None or student_solution is None:
        raise HTTPException(422, 'body must contain "expected_solution" and "student_solution" diagram objects')
    try:
        return validate(expected_solution, student_solution, payload.get('algorithm'))
    except (SchemaError, KeyError, TypeError) as e:
        raise HTTPException(422, f'malformed diagram: {e!r}')
    except ValueError as e:
        raise HTTPException(422, str(e))
    except EngineError as e:
        raise HTTPException(500, str(e))

@app.post('/compare-names')
def compare_names_endpoint(payload: dict = Body(...)):
    expected_solution = payload.get('expected_solution')
    student_solution = payload.get('student_solution')
    if not isinstance(expected_solution, list) or not isinstance(student_solution, list):
        raise HTTPException(422, 'body must contain "expected_solution" and "student_solution" arrays of names')
    return compare_entities(
        expected_solution, student_solution,
        weights=payload.get('weights'),
        penalties=payload.get('penalties'),
        similarity_threshold=payload.get('similarity_threshold', DEFAULT_SIMILARITY_THRESHOLD),
        custom_ontology=payload.get('custom_ontology') or (),
    )

from fastapi import Depends
from app.modules.auth.dependencies import get_current_user, require_teacher
from app.db.models import User, UserRole

@app.get('/questions')
def questions_list(current_user: User = Depends(get_current_user)):
    all_qs = store.list_questions()
    if current_user.role == UserRole.STUDENT:
        return [q for q in all_qs if q.get('is_published')]
    return all_qs

@app.post('/questions')
def questions_create(payload: dict = Body(...), current_user: User = Depends(require_teacher)):
    title = payload.get('title')
    question = payload.get('question')
    solution = payload.get('solution')
    reviewer_email = payload.get('reviewer_email')
    owner_email = payload.get('owner_email')
    
    if not title or not question or solution is None:
        raise HTTPException(422, 'body must contain "title", "question" and "solution"')
        
    return {
        'id': store.create_question(
            title, question, solution,
            created_by_id=current_user.id,
            reviewer_email=reviewer_email,
            owner_email=owner_email,
            is_published=False  # default unpublished
        )
    }

@app.get('/questions/{question_id}')
def questions_get(question_id: str, include_solution: bool = False, current_user: User = Depends(get_current_user)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')
        
    # Security Rule: Students cannot see unpublished questions
    if current_user.role == UserRole.STUDENT and not question.get('is_published'):
        raise HTTPException(403, 'This question is not published.')

    # Security Rule: Students & Reviewers CANNOT see the solution
    is_student = current_user.role == UserRole.STUDENT
    is_reviewer = str(current_user.id) == str(question.get('reviewer_id'))
    
    if is_student or is_reviewer or not include_solution:
        if 'solution' in question:
            del question['solution']
            
    return question

def check_question_permission(question: dict, user: User, action: str = "edit"):
    is_creator = str(user.id) == str(question.get('created_by'))
    is_owner = str(user.id) == str(question.get('owner_id'))
    is_admin = user.role == UserRole.ADMIN
    if not (is_creator or is_owner or is_admin):
        raise HTTPException(403, f'Only the Creator, Owner, or Admin can {action} this question.')

@app.delete('/questions/{question_id}')
def questions_delete(question_id: str, current_user: User = Depends(require_teacher)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')
        
    check_question_permission(question, current_user, "delete")
        
    if not store.delete_question(question_id):
        raise HTTPException(404, f'no question with id {question_id}')
    return {'ok': True }

@app.put('/questions/{question_id}')
def questions_update(question_id: str, payload: dict = Body(...), current_user: User = Depends(require_teacher)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')
        
    check_question_permission(question, current_user, "edit")

    title = payload.get('title')
    description = payload.get('question')
    solution = payload.get('solution')
    reviewer_email = payload.get('reviewer_email')
    owner_email = payload.get('owner_email')
    is_published = payload.get('is_published')

    if not store.update_question(question_id, title, description, solution, reviewer_email, owner_email, is_published):
        raise HTTPException(404, f'no question with id {question_id}')
    return {'ok': True}

@app.get('/questions/{question_id}/playground')
def questions_get_playground(question_id: str, current_user: User = Depends(get_current_user)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    if current_user.role == UserRole.STUDENT and not question.get('is_published'):
        raise HTTPException(403, 'This question is not published.')

    pg = store.get_or_create_user_playground(question_id, current_user)
    if not pg:
        raise HTTPException(404, f'failed to load playground for question {question_id}')
    return pg


@app.put('/questions/{question_id}/playground')
def questions_save_playground(question_id: str, payload: dict = Body(...), current_user: User = Depends(get_current_user)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    if current_user.role == UserRole.STUDENT and not question.get('is_published'):
        raise HTTPException(403, 'This question is not published.')

    diagram_json = payload.get('diagram_json') if isinstance(payload, dict) and 'diagram_json' in payload else payload

    pg = store.save_user_playground(question_id, current_user, diagram_json)
    if not pg:
        raise HTTPException(404, f'failed to save playground for question {question_id}')
    return {"ok": True, "playground": pg}


@app.get('/questions/{question_id}/solution')
def questions_get_solution(question_id: str, current_user: User = Depends(get_current_user)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    if current_user.role == UserRole.STUDENT:
        raise HTTPException(403, 'Students are not allowed to reveal official reference solutions.')

    solution_pg = store.get_question_solution_playground(question_id)
    if not solution_pg:
        raise HTTPException(404, f'No official solution found for question {question_id}')

    return {"solution": solution_pg.get("diagram_json") or {}}


@app.post('/questions/{question_id}/submit')
def questions_submit(question_id: str, payload: dict = Body({}), current_user: User = Depends(get_current_user)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    if current_user.role == UserRole.STUDENT and not question.get('is_published'):
        raise HTTPException(403, 'This question is not published.')

    if isinstance(payload, dict) and payload.get('student') is not None:
        store.save_user_playground(question_id, current_user, payload.get('student'))

    algorithm = payload.get('algorithm') if isinstance(payload, dict) else None

    try:
        result, error_msg = store.submit_user_playground(question_id, current_user, algorithm)
        if error_msg:
            raise HTTPException(400, error_msg)
        return result

    except (SchemaError, KeyError, TypeError) as e:
        raise HTTPException(422, f'malformed diagram: {e!r}')
    except ValueError as e:
        raise HTTPException(422, str(e))
    except EngineError as e:
        raise HTTPException(500, str(e))


