"""
Phase 8 — Comprehensive End-to-End Test Suite across 10 Distinct Submission Scenarios.

Scenarios Covered:
  1. Completely correct schema (Student, Course, Student_Course junction table) -> 100% accepted
  2. Missing required entity (Course table missing) -> partial credit, anti-cascading diagnostic
  3. Missing foreign key (Student_Course has columns, but no FK to Student) -> FK violation caught
  4. Incorrect cardinality (e.g. 1:1 instead of M:N) -> relationship deduction
  5. Missing junction table where M:N is required -> junction table suggestion
  6. Junction table with incorrect keys (missing composite PK) -> duplicate test failure
  7. Duplicate association correctly rejected by valid schema -> behavioral test passes
  8. Schema that allows invalid reference (FK missing) -> negative test fails with warning
  9. Malformed or incomplete diagram (empty tables, invalid identifiers) -> structural rejection
 10. Submission that causes SQL execution to fail -> graceful error handling without server crash
"""

import pytest

from app.query_validator.converter import convert_diagram_to_relational
from app.query_validator.scorer import evaluate_submission
from app.query_validator.spec import make_student_course_spec
from tests.test_converter import make_canonical_student_course_diagram


@pytest.fixture
def spec():
    return make_student_course_spec("q_e2e")


class TestPhase8EndToEndScenarios:

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 1: A completely correct schema
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_1_completely_correct_schema(self, spec):
        doc = make_canonical_student_course_diagram()
        report = evaluate_submission(spec, doc)

        assert report.is_valid is True
        assert report.status == "accepted"
        assert report.total_marks_earned == 100.0
        assert report.percentage == 100.0
        assert len(report.all_failed_checks) == 0
        assert len(report.diagram_errors) == 0
        assert report.behavioral_test_results["total_marks_earned"] == 25.0

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 2: A missing required entity
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_2_missing_required_entity(self, spec):
        doc = make_canonical_student_course_diagram()
        # Remove Course table
        doc["tables"] = [t for t in doc["tables"] if t["name"] != "Course"]
        doc["relationships"] = [r for r in doc["relationships"] if r["endTable"] != "t2"]

        report = evaluate_submission(spec, doc)

        assert report.is_valid is False
        assert report.percentage < 80.0
        # Criterion 1 loses marks
        assert report.criteria["entities_and_attributes"].marks_earned < 25.0
        # Anti-cascading captures missing entity
        assert any("course" in err.lower() for err in report.root_cause_errors)
        assert any("Create a table named 'Course'" in s for s in report.suggestions)

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 3: A missing foreign key
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_3_missing_foreign_key(self, spec):
        doc = make_canonical_student_course_diagram()
        # Remove the foreign key relationship to Student
        doc["relationships"] = [r for r in doc["relationships"] if r["endTable"] != "t1"]

        report = evaluate_submission(spec, doc)

        assert report.is_valid is False
        assert report.criteria["keys_and_constraints"].marks_earned < 25.0
        # Behavioral test for invalid student FK must fail because constraint is missing
        b_failed = [t["test_name"] for t in report.behavioral_test_results["failed_tests"]]
        assert "enroll_nonexistent_student_rejected" in b_failed
        assert any("foreign key" in s.lower() for s in report.suggestions)

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 4: An incorrect cardinality
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_4_incorrect_cardinality(self, spec):
        # Student creates Student and Course and draws a 1:1 relationship instead of M:N
        doc = {
            "tables": [
                {
                    "id": "t1",
                    "name": "Student",
                    "fields": [
                        {"id": "f1", "name": "student_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                        {"id": "f2", "name": "name", "type": "VARCHAR", "notNull": True},
                    ],
                },
                {
                    "id": "t2",
                    "name": "Course",
                    "fields": [
                        {"id": "f3", "name": "course_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                        {"id": "f4", "name": "student_id", "type": "INTEGER", "notNull": True},
                    ],
                },
            ],
            "relationships": [
                {
                    "id": "r1",
                    "startTable": "t2",
                    "startField": "f4",
                    "endTable": "t1",
                    "endField": "f1",
                    "cardinality": "one_to_one",
                }
            ],
        }

        report = evaluate_submission(spec, doc)

        assert report.is_valid is False
        # M:N relationship requirement fails
        assert report.criteria["relationships_and_cardinalities"].marks_earned == 0.0

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 5: A missing junction table where one is required
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_5_missing_junction_table(self, spec):
        # Only Student and Course, no junction table and no M:N edge
        doc = {
            "tables": [
                {
                    "id": "t1",
                    "name": "Student",
                    "fields": [
                        {"id": "f1", "name": "student_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                        {"id": "f2", "name": "name", "type": "VARCHAR", "notNull": True},
                    ],
                },
                {
                    "id": "t2",
                    "name": "Course",
                    "fields": [
                        {"id": "f3", "name": "course_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                        {"id": "f4", "name": "title", "type": "VARCHAR", "notNull": True},
                    ],
                },
            ],
            "relationships": [],
        }

        report = evaluate_submission(spec, doc)

        assert report.is_valid is False
        assert any("junction table" in f.lower() for f in report.all_failed_checks)
        assert any("junction table" in s.lower() for s in report.suggestions)

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 6: A junction table with incorrect keys (missing composite PK)
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_6_junction_table_missing_composite_pk(self, spec):
        doc = make_canonical_student_course_diagram()
        # In Student_Course, remove primaryKey from BOTH fields (no PK or uniqueness)
        for f in doc["tables"][2]["fields"]:
            f["primaryKey"] = False

        report = evaluate_submission(spec, doc)

        # Inserting a duplicate (student 1, course 1) twice should succeed if no PK/uniqueness,
        # which means the negative test 'duplicate_enrollment_rejected' properly fails
        b_failed = [t["test_name"] for t in report.behavioral_test_results["failed_tests"]]
        assert "duplicate_enrollment_rejected" in b_failed

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 7: A duplicate association that should be rejected
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_7_duplicate_association_properly_rejected(self, spec):
        # Canonical schema has composite PK (student_id, course_id)
        doc = make_canonical_student_course_diagram()
        report = evaluate_submission(spec, doc)

        b_passed = [t["test_name"] for t in report.behavioral_test_results["passed_tests"]]
        assert "duplicate_enrollment_rejected" in b_passed

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 8: A schema that allows an invalid reference (FK omitted)
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_8_schema_allows_invalid_reference(self, spec):
        doc = make_canonical_student_course_diagram()
        # Remove both foreign keys
        doc["relationships"] = []

        report = evaluate_submission(spec, doc)

        # Both invalid FK rejection tests should fail because database accepted the invalid inserts
        b_failed = [t["test_name"] for t in report.behavioral_test_results["failed_tests"]]
        assert "enroll_nonexistent_student_rejected" in b_failed
        assert "enroll_nonexistent_course_rejected" in b_failed

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 9: A malformed or incomplete diagram
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_9_malformed_incomplete_diagram(self, spec):
        bad_docs = [
            {"tables": []},  # No tables
            {"tables": [{"id": "t1", "name": "", "fields": []}]},  # Empty name and no fields
            {"tables": "not a list"},  # Invalid tables type
        ]

        for bad in bad_docs:
            report = evaluate_submission(spec, bad)
            assert report.is_valid is False
            assert report.status == "rejected"
            assert report.percentage == 0.0
            assert len(report.diagram_errors) > 0

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 10: A submission that causes SQL execution to fail
    # ──────────────────────────────────────────────────────────────────────────
    def test_scenario_10_sql_execution_failure_handled_gracefully(self, spec):
        doc = make_canonical_student_course_diagram()
        # Add an invalid data type / SQL fragment that causes SQLite execution error
        doc["tables"][0]["fields"][0]["type"] = "INVALID TYPE ((("

        # The validator should gracefully catch and report rather than crashing the API
        report = evaluate_submission(spec, doc)
        assert report.is_valid is False
        assert report.status == "rejected"
        assert len(report.suggestions) > 0