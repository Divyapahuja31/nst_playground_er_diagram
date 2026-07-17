from fastapi import FastAPI, Body, HTTPException
from er_validator import store



app = FastAPI()

@app.get('/health')
def health():
    return {"okay": True}

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


@app.get('/questions/{qid}')
def questions_get(qid: int, include_solution: bool = False):
    question = store.get_question(qid)
    if question is None:
        raise HTTPException(404, f'no question with id {qid}')
    if not include_solution:
        del question['solution']
    return question

@app.delete('/questions/{qid}')
def questions_delete(qid: int):
    if not store.delete_question(qid):
        raise HTTPException(404, f'no question with id {qid}')
    return {'ok': True }

