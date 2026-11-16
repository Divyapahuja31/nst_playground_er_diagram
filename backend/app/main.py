import uuid
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
    is_teacher = user.role in (UserRole.TEACHER, UserRole.ADMIN)
    is_creator = str(user.id) == str(question.get('created_by'))
    is_owner = str(user.id) == str(question.get('owner_id'))
    is_admin = user.role == UserRole.ADMIN
    if not (is_teacher or is_creator or is_owner or is_admin):
        raise HTTPException(403, f'Only teachers or administrators can {action} this question.')

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


# ── Query-Validator spec endpoints (Phase 1) ──────────────────────────

from app.query_validator.spec import (
    load_spec, save_spec, spec_from_dict, spec_to_dict, validate_spec,
)

@app.get('/questions/{question_id}/spec')
def questions_get_spec(question_id: str, current_user: User = Depends(require_teacher)):
    """Return the query-validator spec for a question (teachers only)."""
    spec = load_spec(question_id)
    if spec is None:
        raise HTTPException(404, f'no spec found for question {question_id}')
    return spec_to_dict(spec)


@app.put('/questions/{question_id}/spec')
def questions_save_spec(
    question_id: str,
    payload: dict = Body(...),
    current_user: User = Depends(require_teacher),
):
    """
    Create or replace the query-validator spec for a question (teachers only).
    The payload must be a valid spec_json object.
    """
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    check_question_permission(question, current_user, "update spec for")

    try:
        spec = spec_from_dict(question_id, payload)
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(422, f'malformed spec: {e!r}')

    errors = validate_spec(spec)
    if errors:
        raise HTTPException(422, {'errors': errors})

    if not save_spec(question_id, spec):
        raise HTTPException(404, f'no question with id {question_id}')

    return {'ok': True}


@app.delete('/questions/{question_id}/spec')
def questions_delete_spec(question_id: str, current_user: User = Depends(require_teacher)):
    """Remove query-validator spec for a question (teachers only)."""
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    check_question_permission(question, current_user, "delete spec for")

    from app.db.db import SessionLocal
    from app.db.models import Question
    db = SessionLocal()
    try:
        q_uuid = uuid.UUID(str(question_id))
        q = db.query(Question).filter(Question.id == q_uuid).first()
        if q:
            q.spec_json = None
            db.commit()
    finally:
        db.close()

    return {'ok': True}


@app.post('/questions/{question_id}/test-spec')
def questions_test_spec(
    question_id: str,
    payload: dict = Body(...),
    current_user: User = Depends(require_teacher),
):
    """
    Test a query-validator spec against a diagram (teachers only).
    Useful to verify SQL test suite before saving.
    """
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    check_question_permission(question, current_user, "test spec for")

    spec_data = payload.get("spec")
    diagram_json = payload.get("diagram")
    if not diagram_json or not diagram_json.get("tables"):
        sol_pg = store.get_question_solution_playground(question_id)
        diagram_json = sol_pg.get("diagram_json") if sol_pg else None

    if not diagram_json or not diagram_json.get("tables"):
        raise HTTPException(400, "No diagram tables found on canvas or in saved solution to test against.")

    try:
        spec = spec_from_dict(question_id, spec_data)
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(422, f'malformed spec: {e!r}')

    from app.query_validator.scorer import evaluate_submission
    from app.query_validator.converter import DiagramValidationError
    try:
        report = evaluate_submission(spec, diagram_json)
        return report.to_dict()
    except DiagramValidationError as e:
        raise HTTPException(400, f"Cannot test against diagram: {e}")
    except Exception as e:
        raise HTTPException(400, f"Testing failed: {e}")


@app.post('/questions/{question_id}/generate-spec')
def questions_generate_spec(
    question_id: str,
    payload: dict = Body({}),
    current_user: User = Depends(require_teacher),
):
    """
    Generate a starter query-validator spec from a diagram (teachers only).
    """
    question = store.get_question(question_id)
    if question is None:
        raise HTTPException(404, f'no question with id {question_id}')

    check_question_permission(question, current_user, "generate spec for")

    diagram_json = payload.get("diagram")
    if not diagram_json or not diagram_json.get("tables"):
        sol_pg = store.get_question_solution_playground(question_id)
        diagram_json = sol_pg.get("diagram_json") if sol_pg else None

    if not diagram_json or not diagram_json.get("tables"):
        raise HTTPException(
            400,
            "No tables found on canvas or in saved solution. Please draw at least one table with columns on your canvas first."
        )

    from app.query_validator.converter import convert_diagram_to_relational, DiagramValidationError
    from app.query_validator.spec import (
        EntitySpec,
        AttributeSpec,
        RelationshipSpec,
        SqlTestSpec,
        MarkScheme,
        QuestionSpec,
        spec_to_dict,
    )

    try:
        schema = convert_diagram_to_relational(diagram_json)
    except DiagramValidationError as e:
        raise HTTPException(400, f"Cannot generate spec from canvas diagram: {e}")
    except Exception as e:
        raise HTTPException(400, f"Error processing diagram: {e}")

    entities = []
    sql_tests = []

    for t in schema.tables:
        attrs = []
        for c in t.columns:
            attrs.append(AttributeSpec(
                name=c.name,
                data_type=c.data_type.split('(')[0].upper(),
                is_primary_key=c.is_primary_key,
                is_not_null=c.is_not_null,
                is_unique=c.is_unique,
                required=True,
            ))
        entities.append(EntitySpec(name=t.name, attributes=attrs))

        sample_row = {}
        for c in t.columns:
            dt = c.data_type.upper()
            if "INT" in dt or "NUMERIC" in dt:
                sample_row[c.name] = 1
            elif "BOOL" in dt:
                sample_row[c.name] = True
            elif "DATE" in dt or "TIME" in dt:
                sample_row[c.name] = "2026-01-01"
            else:
                sample_row[c.name] = f"Sample_{c.name[:8]}"

        # Pre-format a clean, ready-to-run raw SQL statement
        col_names = ", ".join(sample_row.keys())
        val_strs = []
        for v in sample_row.values():
            if isinstance(v, (int, float)):
                val_strs.append(str(v))
            elif isinstance(v, bool):
                val_strs.append("TRUE" if v else "FALSE")
            else:
                val_strs.append(f"'{v}'")
        col_vals = ", ".join(val_strs)
        generated_sql = f"INSERT INTO {t.name} ({col_names}) VALUES ({col_vals});"

        sql_tests.append(SqlTestSpec(
            name=f"insert_valid_{t.name.lower()}",
            description=f"Inserting a valid row into {t.name} should succeed",
            kind="insert_valid",
            operation={"entity": t.name, "row": sample_row, "sql": generated_sql},
            expect_success=True,
            marks=round(25.0 / max(1, len(schema.tables)), 1),
        ))

    relationships = []
    diagram_relationships = diagram_json.get("relationships", []) or []
    table_id_to_name = {t["id"]: t["name"] for t in diagram_json.get("tables", []) if "id" in t and "name" in t}
    field_id_to_name = {f["id"]: f["name"] for t in diagram_json.get("tables", []) for f in t.get("fields", []) if "id" in f and "name" in f}

    if diagram_relationships:
        for r in diagram_relationships:
            from_entity = table_id_to_name.get(r.get("startTable"))
            to_entity = table_id_to_name.get(r.get("endTable"))
            if from_entity and to_entity:
                fk_attr = field_id_to_name.get(r.get("endField")) or field_id_to_name.get(r.get("startField"))
                relationships.append(RelationshipSpec(
                    from_entity=from_entity,
                    to_entity=to_entity,
                    cardinality=r.get("cardinality", "one_to_many"),
                    fk_attribute=fk_attr,
                ))
    else:
        for t in schema.tables:
            for fk in t.foreign_keys:
                is_1to1 = any(fk.columns == uq for uq in t.unique_constraints) or any(
                    (c.name in fk.columns and c.is_unique) for c in t.columns
                )
                card = "one_to_one" if is_1to1 else "one_to_many"
                relationships.append(RelationshipSpec(
                    from_entity=fk.ref_table,
                    to_entity=t.name,
                    cardinality=card,
                    fk_attribute=fk.columns[0] if fk.columns else None,
                ))

    spec = QuestionSpec(
        question_id=question_id,
        entities=entities,
        relationships=relationships,
        sql_tests=sql_tests,
        marks=MarkScheme(
            entities_and_attributes=25.0,
            relationships_and_cardinalities=25.0,
            keys_and_constraints=25.0,
            sql_behavioral_tests=25.0,
        ),
    )
    return spec_to_dict(spec)
