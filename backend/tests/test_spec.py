"""
Tests for Phase 1 — QuestionSpec dataclass, validator, serialization,
and the /questions/{id}/spec API endpoints.

Run: pytest tests/test_spec.py -v
"""

import pytest
from app.query_validator.spec import (
    AttributeSpec,
    EntitySpec,
    MarkScheme,
    QuestionSpec,
    RelationshipSpec,
    SqlTestSpec,
    make_student_course_spec,
    spec_from_dict,
    spec_to_dict,
    validate_spec,
)


# ══════════════════════════════════════════
#  Helpers
# ══════════════════════════════════════════

DUMMY_QID = "00000000-0000-0000-0000-000000000001"


def minimal_valid_spec() -> QuestionSpec:
    """Smallest spec that passes validate_spec()."""
    return QuestionSpec(
        question_id=DUMMY_QID,
        entities=[
            EntitySpec(
                name="Student",
                attributes=[
                    AttributeSpec(
                        name="student_id",
                        data_type="INTEGER",
                        is_primary_key=True,
                        is_not_null=True,
                    )
                ],
            )
        ],
        marks=MarkScheme(
            entities_and_attributes=25.0,
            relationships_and_cardinalities=25.0,
            keys_and_constraints=25.0,
            sql_behavioral_tests=25.0,
        ),
    )


# ══════════════════════════════════════════
#  validate_spec unit tests
# ══════════════════════════════════════════

class TestValidateSpec:
    def test_valid_minimal_spec_passes(self):
        spec = minimal_valid_spec()
        assert validate_spec(spec) == []

    def test_valid_student_course_spec_passes(self):
        spec = make_student_course_spec(DUMMY_QID)
        errors = validate_spec(spec)
        assert errors == [], f"Unexpected errors: {errors}"

    def test_no_entities_rejected(self):
        spec = QuestionSpec(question_id=DUMMY_QID, entities=[])
        errors = validate_spec(spec)
        assert any("at least one entity" in e for e in errors)

    def test_entity_without_primary_key_rejected(self):
        spec = QuestionSpec(
            question_id=DUMMY_QID,
            entities=[
                EntitySpec(
                    name="Student",
                    attributes=[
                        AttributeSpec(name="name", data_type="VARCHAR")
                    ],
                )
            ],
        )
        errors = validate_spec(spec)
        assert any("primary key" in e for e in errors)

    def test_duplicate_entity_name_rejected(self):
        attr = AttributeSpec(name="id", data_type="INTEGER", is_primary_key=True, is_not_null=True)
        spec = QuestionSpec(
            question_id=DUMMY_QID,
            entities=[
                EntitySpec(name="Student", attributes=[attr]),
                EntitySpec(name="Student", attributes=[attr]),
            ],
        )
        errors = validate_spec(spec)
        assert any("duplicate entity" in e for e in errors)

    def test_duplicate_attribute_name_rejected(self):
        spec = QuestionSpec(
            question_id=DUMMY_QID,
            entities=[
                EntitySpec(
                    name="Student",
                    attributes=[
                        AttributeSpec(name="id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                        AttributeSpec(name="id", data_type="VARCHAR"),  # duplicate
                    ],
                )
            ],
        )
        errors = validate_spec(spec)
        assert any("duplicate attribute" in e for e in errors)

    def test_invalid_data_type_rejected(self):
        spec = QuestionSpec(
            question_id=DUMMY_QID,
            entities=[
                EntitySpec(
                    name="Student",
                    attributes=[
                        AttributeSpec(name="id", data_type="IMAGINARY_TYPE", is_primary_key=True, is_not_null=True),
                    ],
                )
            ],
        )
        errors = validate_spec(spec)
        assert any("unsupported data_type" in e for e in errors)

    def test_pk_without_not_null_rejected(self):
        spec = QuestionSpec(
            question_id=DUMMY_QID,
            entities=[
                EntitySpec(
                    name="Student",
                    attributes=[
                        AttributeSpec(name="id", data_type="INTEGER", is_primary_key=True, is_not_null=False),
                    ],
                )
            ],
        )
        errors = validate_spec(spec)
        assert any("is_not_null=true" in e for e in errors)

    def test_relationship_unknown_entity_rejected(self):
        spec = minimal_valid_spec()
        spec.relationships = [
            RelationshipSpec(
                from_entity="Student",
                to_entity="Ghost",  # does not exist
                cardinality="one_to_many",
                fk_attribute="student_id",
            )
        ]
        errors = validate_spec(spec)
        assert any("Ghost" in e for e in errors)

    def test_invalid_cardinality_rejected(self):
        spec = minimal_valid_spec()
        spec.entities.append(
            EntitySpec(name="Course", attributes=[
                AttributeSpec(name="id", data_type="INTEGER", is_primary_key=True, is_not_null=True)
            ])
        )
        spec.relationships = [
            RelationshipSpec(
                from_entity="Student",
                to_entity="Course",
                cardinality="banana",  # invalid
                fk_attribute="student_id",
            )
        ]
        errors = validate_spec(spec)
        assert any("invalid cardinality" in e for e in errors)

    def test_one_to_many_without_fk_attribute_rejected(self):
        spec = minimal_valid_spec()
        spec.entities.append(
            EntitySpec(name="Course", attributes=[
                AttributeSpec(name="id", data_type="INTEGER", is_primary_key=True, is_not_null=True)
            ])
        )
        spec.relationships = [
            RelationshipSpec(
                from_entity="Student",
                to_entity="Course",
                cardinality="one_to_many",
                fk_attribute=None,  # missing
            )
        ]
        errors = validate_spec(spec)
        assert any("fk_attribute is required" in e for e in errors)

    def test_invalid_sql_test_kind_rejected(self):
        spec = minimal_valid_spec()
        spec.sql_tests = [
            SqlTestSpec(name="bad_test", description="", kind="explode", expect_success=True, marks=5.0)
        ]
        errors = validate_spec(spec)
        assert any("invalid kind" in e for e in errors)

    def test_negative_marks_rejected(self):
        spec = minimal_valid_spec()
        spec.sql_tests = [
            SqlTestSpec(name="t", description="", kind="insert_valid", expect_success=True, marks=-1.0)
        ]
        errors = validate_spec(spec)
        assert any("marks cannot be negative" in e for e in errors)

    def test_mark_scheme_not_summing_to_100_rejected(self):
        spec = minimal_valid_spec()
        spec.marks = MarkScheme(
            entities_and_attributes=10.0,
            relationships_and_cardinalities=10.0,
            keys_and_constraints=10.0,
            sql_behavioral_tests=10.0,  # total = 40
        )
        errors = validate_spec(spec)
        assert any("total must be 100" in e for e in errors)


# ══════════════════════════════════════════
#  Serialization round-trip
# ══════════════════════════════════════════

class TestSpecSerialization:
    def test_round_trip_minimal(self):
        original = minimal_valid_spec()
        as_dict = spec_to_dict(original)
        restored = spec_from_dict(DUMMY_QID, as_dict)

        assert restored.entities[0].name == original.entities[0].name
        assert restored.entities[0].attributes[0].name == original.entities[0].attributes[0].name
        assert restored.entities[0].attributes[0].is_primary_key is True
        assert restored.marks.entities_and_attributes == 25.0

    def test_round_trip_student_course(self):
        original = make_student_course_spec(DUMMY_QID)
        as_dict = spec_to_dict(original)
        restored = spec_from_dict(DUMMY_QID, as_dict)

        entity_names = {e.name for e in restored.entities}
        assert entity_names == {"Student", "Course", "Student_Course"}

        rel = restored.relationships[0]
        assert rel.cardinality == "many_to_many"
        assert rel.junction_table_name == "Student_Course"

        assert len(restored.sql_tests) == 6
        assert restored.marks.total() == 100.0

    def test_spec_to_dict_contains_all_keys(self):
        spec = make_student_course_spec(DUMMY_QID)
        d = spec_to_dict(spec)
        assert "version" in d
        assert "entities" in d
        assert "relationships" in d
        assert "sql_tests" in d
        assert "marks" in d

    def test_mark_scheme_total(self):
        m = MarkScheme(25.0, 25.0, 25.0, 25.0)
        assert m.total() == 100.0


# ══════════════════════════════════════════
#  API endpoint tests
# ══════════════════════════════════════════

SAMPLE_DIAGRAM = {
    "tables": [
        {
            "id": 1,
            "name": "Student",
            "fields": [
                {"id": 1, "name": "student_id", "type": "INTEGER", "primaryKey": True, "notNull": True,
                 "unique": False, "increment": False, "def": "", "checkConstraint": None},
            ],
        }
    ],
    "relationships": [],
}

STUDENT_COURSE_SPEC_DICT = spec_to_dict(make_student_course_spec(DUMMY_QID))


class TestSpecEndpoints:
    def _create_question(self, client, teacher_headers) -> str:
        """Helper: creates a question and returns its id."""
        res = client.post(
            "/questions",
            json={"title": "Test", "question": "Describe a schema.", "solution": SAMPLE_DIAGRAM},
            headers=teacher_headers,
        )
        assert res.status_code in (200, 201), res.text
        return res.json()["id"]

    def test_get_spec_404_when_no_spec(self, client, teacher_auth):
        qid = self._create_question(client, teacher_auth["headers"])
        res = client.get(f"/questions/{qid}/spec", headers=teacher_auth["headers"])
        assert res.status_code == 404

    def test_put_spec_creates_spec(self, client, teacher_auth):
        qid = self._create_question(client, teacher_auth["headers"])
        spec = spec_to_dict(make_student_course_spec(qid))
        res = client.put(f"/questions/{qid}/spec", json=spec, headers=teacher_auth["headers"])
        assert res.status_code == 200, res.text
        assert res.json()["ok"] is True

    def test_get_spec_after_put(self, client, teacher_auth):
        qid = self._create_question(client, teacher_auth["headers"])
        spec = spec_to_dict(make_student_course_spec(qid))
        client.put(f"/questions/{qid}/spec", json=spec, headers=teacher_auth["headers"])

        res = client.get(f"/questions/{qid}/spec", headers=teacher_auth["headers"])
        assert res.status_code == 200
        data = res.json()
        entity_names = [e["name"] for e in data["entities"]]
        assert "Student" in entity_names
        assert "Course" in entity_names

    def test_put_spec_invalid_spec_rejected(self, client, teacher_auth):
        qid = self._create_question(client, teacher_auth["headers"])
        bad_spec = {
            "version": 1,
            "entities": [],  # no entities — should fail validation
            "relationships": [],
            "sql_tests": [],
            "marks": {"entities_and_attributes": 25, "relationships_and_cardinalities": 25,
                      "keys_and_constraints": 25, "sql_behavioral_tests": 25},
        }
        res = client.put(f"/questions/{qid}/spec", json=bad_spec, headers=teacher_auth["headers"])
        assert res.status_code == 422

    def test_student_cannot_access_spec(self, client, teacher_auth, student_auth):
        qid = self._create_question(client, teacher_auth["headers"])
        spec = spec_to_dict(make_student_course_spec(qid))
        client.put(f"/questions/{qid}/spec", json=spec, headers=teacher_auth["headers"])

        res = client.get(f"/questions/{qid}/spec", headers=student_auth["headers"])
        assert res.status_code == 403

    def test_put_spec_nonexistent_question(self, client, teacher_auth):
        fake_id = "00000000-0000-0000-0000-000000000099"
        spec = spec_to_dict(make_student_course_spec(fake_id))
        res = client.put(f"/questions/{fake_id}/spec", json=spec, headers=teacher_auth["headers"])
        assert res.status_code in (403, 404)
