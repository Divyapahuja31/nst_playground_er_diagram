from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from er_validator import store
from er_validator.core import validate
from er_validator.engine.base import EngineError
from er_validator.name_matcher import DEFAULT_SIMILARITY_THRESHOLD, compare_entities
from er_validator.schema import SchemaError

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get('/questions')
def questions_list():
    return store.list_questions()

@app.post('/questions')
def questions_create(payload: dict = Body(...)):
    title = payload.get('title')
    question = payload.get('question')
    solution = payload.get('solution')
    if not title or not question or solution is None:
        raise HTTPException(422, 'body must contain "title", "question" and "solution"')
    return {'id': store.create_question(title, question, solution)}


@app.get('/questions/{question_id}')
def questions_get(question_id: int, include_solution: bool = False):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')
    if not include_solution:
        del question['solution']
    return question

@app.delete('/questions/{question_id}')
def questions_delete(question_id: int):
    if not store.delete_question(question_id):
        raise HTTPException(404, f'no question with id {question_id}')
    return {'ok': True }

@app.post('/questions/{question_id}/submit')
def questions_submit(question_id: int, payload: dict = Body(...)):
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')
    student = payload.get('student')
    if student is None:
        raise HTTPException(422, 'body must contain a "student" diagram object')
    try:
        return validate(question['solution'], student, payload.get('algorithm'))
    except (SchemaError, KeyError, TypeError) as e:
        raise HTTPException(422, f'malformed diagram: {e!r}')
    except ValueError as e:
        raise HTTPException(422, str(e))
    except EngineError as e:
        raise HTTPException(500, str(e))
