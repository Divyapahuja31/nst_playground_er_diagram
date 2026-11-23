"""
QuestionSpec — structured specification for a question's expected database design.

A spec is stored as spec_json (JSONB) on the questions table and describes:
  - Required entities (tables) and their attributes
  - Primary key requirements per entity
  - Relationships between entities with cardinality
  - Foreign key requirements
  - Mark allocation per criterion
  - Behavioral SQL test cases

V1 contract:
  - Entity and attribute names must exactly match those specified (case-insensitive).
  - Junction table names follow the convention: TableA_TableB in alphabetical order.
  - All names use underscores, not hyphens.

Usage
-----
    from app.query_validator.spec import QuestionSpec, load_spec, validate_spec

    spec = load_spec(question_id)          # returns QuestionSpec | None
    errors = validate_spec(spec)           # returns list[str], empty = valid
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Optional

from app.db.db import SessionLocal
from app.db.models import Question


# ══════════════════════════════════════════
#  Dataclasses
# ══════════════════════════════════════════

@dataclass
class AttributeSpec:
    """Describes one column in a required entity."""
    name: str                      # e.g. "student_id"
    data_type: str                 # e.g. "INTEGER", "VARCHAR"
    is_primary_key: bool = False
    is_not_null: bool = False
    is_unique: bool = False
    # If True the column must exist; if False it is optional (not checked in V1 structural pass)
    required: bool = True


@dataclass
class EntitySpec:
    """Describes one required table."""
    name: str                                   # e.g. "Student"
    attributes: list[AttributeSpec] = field(default_factory=list)


@dataclass
class RelationshipSpec:
    """Describes one required relationship between two entities."""
    from_entity: str                # entity name
    to_entity: str                  # entity name
    cardinality: str                # "one_to_one" | "one_to_many" | "many_to_many"
    # For one_to_many: which attribute in which entity carries the FK
    # For many_to_many: ignored — a junction table is expected instead
    fk_attribute: Optional[str] = None          # e.g. "student_id" (in to_entity)
    junction_table_name: Optional[str] = None   # override auto-generated name if needed


@dataclass
class SqlTestSpec:
    """One SQL behavioral test case associated with a question."""
    name: str                      # Human-readable label
    description: str               # Explains what is being tested
    # The operation SQL is generated dynamically in Phase 4 from the student's
    # actual schema.  For V1 we record the intent as structured fields.
    kind: str                      # See VALID_TEST_KINDS below
    setup: dict = field(default_factory=dict)    # data needed before the operation
    operation: dict = field(default_factory=dict) # what to do
    expect_success: bool = True    # True = operation should succeed; False = should fail/raise
    marks: float = 0.0


VALID_TEST_KINDS = {
    "insert_valid",       # insert a valid row — should succeed
    "insert_duplicate",   # insert duplicate PK/unique row — should fail
    "insert_fk_valid",    # insert row referencing an existing FK — should succeed
    "insert_fk_invalid",  # insert row referencing a nonexistent FK — should fail
    "select_count",       # run a SELECT COUNT and check expected result
    "unique_constraint",  # inserting duplicate unique value should fail
    "raw_sql",            # custom SQL query directly provided by teacher
    "custom_sql",         # custom SQL query directly provided by teacher
}


@dataclass
class MarkScheme:
    """Mark allocation per criterion (total should sum to 100)."""
    entities_and_attributes: float = 25.0
    relationships_and_cardinalities: float = 25.0
    keys_and_constraints: float = 25.0
    sql_behavioral_tests: float = 25.0

    def total(self) -> float:
        return (
            self.entities_and_attributes
            + self.relationships_and_cardinalities
            + self.keys_and_constraints
            + self.sql_behavioral_tests
        )


@dataclass
class QuestionSpec:
    """Complete specification for one question."""
    question_id: str
    entities: list[EntitySpec] = field(default_factory=list)
    relationships: list[RelationshipSpec] = field(default_factory=list)
    sql_tests: list[SqlTestSpec] = field(default_factory=list)
    marks: MarkScheme = field(default_factory=MarkScheme)
    version: int = 1   # spec schema version for forward-compatibility


# ══════════════════════════════════════════
#  Spec JSON serialization helpers
# ══════════════════════════════════════════

def _attribute_from_dict(d: dict) -> AttributeSpec:
    return AttributeSpec(
        name=str(d["name"]),
        data_type=str(d.get("data_type", "VARCHAR")).upper(),
        is_primary_key=bool(d.get("is_primary_key", False)),
        is_not_null=bool(d.get("is_not_null", False)),
        is_unique=bool(d.get("is_unique", False)),
        required=bool(d.get("required", True)),
    )


def _entity_from_dict(d: dict) -> EntitySpec:
    return EntitySpec(
        name=str(d["name"]),
        attributes=[_attribute_from_dict(a) for a in d.get("attributes", [])],
    )


def _relationship_from_dict(d: dict) -> RelationshipSpec:
    return RelationshipSpec(
        from_entity=str(d["from_entity"]),
        to_entity=str(d["to_entity"]),
        cardinality=str(d["cardinality"]),
        fk_attribute=d.get("fk_attribute"),
        junction_table_name=d.get("junction_table_name"),
    )


def _sql_test_from_dict(d: dict) -> SqlTestSpec:
    return SqlTestSpec(
        name=str(d["name"]),
        description=str(d.get("description", "")),
        kind=str(d["kind"]),
        setup=d.get("setup", {}),
        operation=d.get("operation", {}),
        expect_success=bool(d.get("expect_success", True)),
        marks=float(d.get("marks", 0.0)),
    )


def _marks_from_dict(d: dict) -> MarkScheme:
    return MarkScheme(
        entities_and_attributes=float(d.get("entities_and_attributes", 25.0)),
        relationships_and_cardinalities=float(d.get("relationships_and_cardinalities", 25.0)),
        keys_and_constraints=float(d.get("keys_and_constraints", 25.0)),
        sql_behavioral_tests=float(d.get("sql_behavioral_tests", 25.0)),
    )


def spec_from_dict(question_id: str, doc: dict) -> QuestionSpec:
    """Deserialise a raw dict (from JSONB) into a QuestionSpec."""
    marks_raw = doc.get("marks", {})
    return QuestionSpec(
        question_id=question_id,
        entities=[_entity_from_dict(e) for e in doc.get("entities", [])],
        relationships=[_relationship_from_dict(r) for r in doc.get("relationships", [])],
        sql_tests=[_sql_test_from_dict(t) for t in doc.get("sql_tests", [])],
        marks=_marks_from_dict(marks_raw) if marks_raw else MarkScheme(),
        version=int(doc.get("version", 1)),
    )


def spec_to_dict(spec: QuestionSpec) -> dict:
    """Serialise a QuestionSpec back to a plain dict (for JSONB storage)."""
    def attr_to_dict(a: AttributeSpec) -> dict:
        return {
            "name": a.name,
            "data_type": a.data_type,
            "is_primary_key": a.is_primary_key,
            "is_not_null": a.is_not_null,
            "is_unique": a.is_unique,
            "required": a.required,
        }

    def entity_to_dict(e: EntitySpec) -> dict:
        return {"name": e.name, "attributes": [attr_to_dict(a) for a in e.attributes]}

    def rel_to_dict(r: RelationshipSpec) -> dict:
        return {
            "from_entity": r.from_entity,
            "to_entity": r.to_entity,
            "cardinality": r.cardinality,
            "fk_attribute": r.fk_attribute,
            "junction_table_name": r.junction_table_name,
        }

    def test_to_dict(t: SqlTestSpec) -> dict:
        return {
            "name": t.name,
            "description": t.description,
            "kind": t.kind,
            "setup": t.setup,
            "operation": t.operation,
            "expect_success": t.expect_success,
            "marks": t.marks,
        }

    return {
        "version": spec.version,
        "entities": [entity_to_dict(e) for e in spec.entities],
        "relationships": [rel_to_dict(r) for r in spec.relationships],
        "sql_tests": [test_to_dict(t) for t in spec.sql_tests],
        "marks": {
            "entities_and_attributes": spec.marks.entities_and_attributes,
            "relationships_and_cardinalities": spec.marks.relationships_and_cardinalities,
            "keys_and_constraints": spec.marks.keys_and_constraints,
            "sql_behavioral_tests": spec.marks.sql_behavioral_tests,
        },
    }


# ══════════════════════════════════════════
#  Validation
# ══════════════════════════════════════════

VALID_CARDINALITIES = {"one_to_one", "one_to_many", "many_to_one", "many_to_many"}
VALID_DATA_TYPES = {"INTEGER", "VARCHAR", "TEXT", "FLOAT", "BOOLEAN", "DATE", "TIMESTAMP", "NUMERIC", "BIGINT", "SMALLINT"}


def validate_spec(spec: QuestionSpec) -> list[str]:
    """
    Validate a QuestionSpec for internal consistency.
    Returns a list of error strings; an empty list means the spec is valid.
    """
    errors: list[str] = []

    if not spec.entities:
        errors.append("spec must define at least one entity")

    entity_names = set()
    for entity in spec.entities:
        if not entity.name or not entity.name.strip():
            errors.append("each entity must have a non-empty name")
            continue

        name = entity.name.strip()
        if name in entity_names:
            errors.append(f"duplicate entity name: '{name}'")
        entity_names.add(name)

        pk_attrs = [a for a in entity.attributes if a.is_primary_key]
        if not pk_attrs:
            errors.append(f"entity '{name}' must have at least one primary key attribute")

        attr_names = set()
        for attr in entity.attributes:
            if not attr.name or not attr.name.strip():
                errors.append(f"entity '{name}': attribute name must be non-empty")
                continue
            aname = attr.name.strip()
            if aname in attr_names:
                errors.append(f"entity '{name}': duplicate attribute name '{aname}'")
            attr_names.add(aname)
            if attr.data_type not in VALID_DATA_TYPES:
                errors.append(
                    f"entity '{name}', attribute '{aname}': "
                    f"unsupported data_type '{attr.data_type}'. "
                    f"Valid: {sorted(VALID_DATA_TYPES)}"
                )
            if attr.is_primary_key and not attr.is_not_null:
                errors.append(
                    f"entity '{name}', attribute '{aname}': "
                    "primary key must have is_not_null=true"
                )

    for rel in spec.relationships:
        if rel.from_entity not in entity_names:
            errors.append(f"relationship references unknown from_entity '{rel.from_entity}'")
        if rel.to_entity not in entity_names:
            errors.append(f"relationship references unknown to_entity '{rel.to_entity}'")
        if rel.cardinality not in VALID_CARDINALITIES:
            errors.append(
                f"relationship {rel.from_entity}→{rel.to_entity}: "
                f"invalid cardinality '{rel.cardinality}'. "
                f"Valid: {sorted(VALID_CARDINALITIES)}"
            )
        # For one_to_many/many_to_one, an FK attribute name is expected
        if rel.cardinality in ("one_to_many", "many_to_one") and not rel.fk_attribute:
            errors.append(
                f"relationship {rel.from_entity}→{rel.to_entity} "
                f"({rel.cardinality}): fk_attribute is required"
            )

    for test in spec.sql_tests:
        if not test.name:
            errors.append("each sql_test must have a non-empty name")
        if test.kind not in VALID_TEST_KINDS:
            errors.append(
                f"sql_test '{test.name}': invalid kind '{test.kind}'. "
                f"Valid: {sorted(VALID_TEST_KINDS)}"
            )
        if test.marks < 0:
            errors.append(f"sql_test '{test.name}': marks cannot be negative")

    total = spec.marks.total()
    if abs(total - 100.0) > 0.01:
        errors.append(f"mark scheme total must be 100, got {total}")

    return errors


# ══════════════════════════════════════════
#  DB accessors
# ══════════════════════════════════════════

def load_spec(question_id: str) -> Optional[QuestionSpec]:
    """
    Load a QuestionSpec from the database.
    Returns None if the question doesn't exist or has no spec_json.
    """
    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
        except ValueError:
            return None
        q = db.query(Question).filter(Question.id == q_uuid).first()
        if q is None or q.spec_json is None:
            return None
        return spec_from_dict(str(question_id), q.spec_json)
    finally:
        db.close()


def save_spec(question_id: str, spec: QuestionSpec) -> bool:
    """
    Persist a QuestionSpec as spec_json on the question row.
    Returns True on success, False if the question was not found.
    Raises ValueError if the spec fails internal validation.
    """
    errors = validate_spec(spec)
    if errors:
        raise ValueError(f"invalid spec: {'; '.join(errors)}")

    db = SessionLocal()
    try:
        try:
            q_uuid = uuid.UUID(str(question_id))
        except ValueError:
            return False
        q = db.query(Question).filter(Question.id == q_uuid).first()
        if q is None:
            return False
        q.spec_json = spec_to_dict(spec)
        db.commit()
        return True
    finally:
        db.close()


# ══════════════════════════════════════════
#  Example spec (Student-Course, V1)
# ══════════════════════════════════════════

def make_student_course_spec(question_id: str) -> QuestionSpec:
    """
    Returns a fully-populated QuestionSpec for the canonical
    'Student can enroll in multiple Courses' many-to-many problem.

    Use this for seeding a question or as a test fixture.
    """
    return QuestionSpec(
        question_id=question_id,
        entities=[
            EntitySpec(
                name="Student",
                attributes=[
                    AttributeSpec(name="student_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                    AttributeSpec(name="name", data_type="VARCHAR", is_not_null=True),
                ],
            ),
            EntitySpec(
                name="Course",
                attributes=[
                    AttributeSpec(name="course_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                    AttributeSpec(name="title", data_type="VARCHAR", is_not_null=True),
                ],
            ),
            EntitySpec(
                name="Student_Course",
                attributes=[
                    AttributeSpec(name="student_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                    AttributeSpec(name="course_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                ],
            ),
        ],
        relationships=[
            RelationshipSpec(
                from_entity="Student",
                to_entity="Course",
                cardinality="many_to_many",
                junction_table_name="Student_Course",
            ),
        ],
        sql_tests=[
            SqlTestSpec(
                name="insert_valid_student",
                description="Inserting a valid student row should succeed",
                kind="insert_valid",
                operation={"entity": "Student", "row": {"student_id": 1, "name": "Alice"}},
                expect_success=True,
                marks=3.0,
            ),
            SqlTestSpec(
                name="insert_valid_course",
                description="Inserting a valid course row should succeed",
                kind="insert_valid",
                operation={"entity": "Course", "row": {"course_id": 1, "title": "Databases"}},
                expect_success=True,
                marks=3.0,
            ),
            SqlTestSpec(
                name="enroll_student_in_course",
                description="Enrolling a student in an existing course should succeed",
                kind="insert_fk_valid",
                setup={
                    "Student": [{"student_id": 1, "name": "Alice"}],
                    "Course": [{"course_id": 1, "title": "Databases"}],
                },
                operation={"entity": "Student_Course", "row": {"student_id": 1, "course_id": 1}},
                expect_success=True,
                marks=4.0,
            ),
            SqlTestSpec(
                name="duplicate_enrollment_rejected",
                description="Enrolling the same student in the same course twice should fail",
                kind="insert_duplicate",
                setup={
                    "Student": [{"student_id": 1, "name": "Alice"}],
                    "Course": [{"course_id": 1, "title": "Databases"}],
                    "Student_Course": [{"student_id": 1, "course_id": 1}],
                },
                operation={"entity": "Student_Course", "row": {"student_id": 1, "course_id": 1}},
                expect_success=False,
                marks=5.0,
            ),
            SqlTestSpec(
                name="enroll_nonexistent_student_rejected",
                description="Referencing a nonexistent student should fail (FK violation)",
                kind="insert_fk_invalid",
                setup={
                    "Course": [{"course_id": 1, "title": "Databases"}],
                },
                operation={"entity": "Student_Course", "row": {"student_id": 999, "course_id": 1}},
                expect_success=False,
                marks=5.0,
            ),
            SqlTestSpec(
                name="enroll_nonexistent_course_rejected",
                description="Referencing a nonexistent course should fail (FK violation)",
                kind="insert_fk_invalid",
                setup={
                    "Student": [{"student_id": 1, "name": "Alice"}],
                },
                operation={"entity": "Student_Course", "row": {"student_id": 1, "course_id": 999}},
                expect_success=False,
                marks=5.0,
            ),
        ],
        marks=MarkScheme(
            entities_and_attributes=25.0,
            relationships_and_cardinalities=25.0,
            keys_and_constraints=25.0,
            sql_behavioral_tests=25.0,
        ),
    )
