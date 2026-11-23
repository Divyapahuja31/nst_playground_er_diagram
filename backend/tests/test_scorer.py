"""
Unit and integration tests for Phase 5 — Validation and Scoring Engine.

Covers:
  - 100% perfect score evaluation on canonical Student-Course diagram
  - Evaluation of synthesized M:N conceptual diagrams
  - Missing entity deduction with anti-cascading attribution
  - Missing foreign key deduction and suggestions
  - Missing primary key deduction and suggestions
  - Graceful handling of malformed and empty diagram submissions
  - Serialization of ValidationReport to dict
"""

import pytest

from app.query_validator.converter import convert_diagram_to_relational
from app.query_validator.scorer import (
    CriterionScore,
    ValidationReport,
    evaluate_submission,
)
from app.query_validator.spec import make_student_course_spec
from tests.test_converter import (
    make_canonical_student_course_diagram,
    make_direct_m2m_diagram,
)


# ══════════════════════════════════════════════════════════════════════════════
#  1. Perfect Score Evaluation
# ══════════════════════════════════════════════════════════════════════════════

class TestScorerPerfectSubmission:
    def test_canonical_student_course_gets_full_marks(self):
        doc = make_canonical_student_course_diagram()
        spec = make_student_course_spec("q1")

        report = evaluate_submission(spec, doc)

        assert report.is_valid is True
        assert report.status == "accepted"
        assert report.total_marks_earned == 100.0
        assert report.total_marks_possible == 100.0
        assert report.percentage == 100.0
        assert len(report.all_failed_checks) == 0

        # Check all 4 criteria received 25.0 marks
        assert report.criteria["entities_and_attributes"].marks_earned == 25.0
        assert report.criteria["relationships_and_cardinalities"].marks_earned == 25.0
        assert report.criteria["keys_and_constraints"].marks_earned == 25.0
        assert report.criteria["sql_behavioral_tests"].marks_earned == 25.0

    def test_direct_m2m_diagram_gets_full_marks(self):
        """A diagram with direct M:N conceptual relationship synthesizes junction and passes."""
        doc = make_direct_m2m_diagram()
        spec = make_student_course_spec("q1")

        report = evaluate_submission(spec, doc)

        assert report.is_valid is True
        assert report.status == "accepted"
        assert report.percentage == 100.0


# ══════════════════════════════════════════════════════════════════════════════
#  2. Flawed Submission Diagnostics & Anti-Cascading
# ══════════════════════════════════════════════════════════════════════════════

class TestScorerFlawedSubmissions:
    def test_missing_required_entity(self):
        """Diagram has Student and Student_Course, but completely missing Course."""
        doc = make_canonical_student_course_diagram()
        doc["tables"] = [t for t in doc["tables"] if t["name"] != "Course"]
        doc["relationships"] = [r for r in doc["relationships"] if r["endTable"] != "t2"]

        spec = make_student_course_spec("q1")
        report = evaluate_submission(spec, doc)

        assert report.is_valid is False
        assert report.percentage < 80.0
        assert "entities_and_attributes" in report.criteria
        assert report.criteria["entities_and_attributes"].marks_earned < 25.0

        # Anti-cascading: check root cause is captured
        assert any("course" in err.lower() for err in report.root_cause_errors)
        assert any("Create a table named 'Course'" in s for s in report.suggestions)

    def test_missing_foreign_keys_penalized_in_keys_and_relationships(self):
        """Student created 3 tables with columns, but did not define relationships/FKs."""
        doc = make_canonical_student_course_diagram()
        doc["relationships"] = []  # No relationships!

        spec = make_student_course_spec("q1")
        report = evaluate_submission(spec, doc)

        assert report.is_valid is False
        # Entities & attributes should still be 25/25
        assert report.criteria["entities_and_attributes"].marks_earned == 25.0

        # Relationships and keys should lose marks
        assert report.criteria["relationships_and_cardinalities"].marks_earned == 0.0
        assert report.criteria["keys_and_constraints"].marks_earned < 25.0
        assert report.criteria["sql_behavioral_tests"].marks_earned < 25.0

        # Suggestions should recommend adding foreign keys
        assert any("foreign key" in s.lower() for s in report.suggestions)

    def test_missing_primary_key_penalized(self):
        """Table Student is missing its primary key."""
        doc = make_canonical_student_course_diagram()
        for f in doc["tables"][0]["fields"]:
            f["primaryKey"] = False

        spec = make_student_course_spec("q1")
        report = evaluate_submission(spec, doc)

        assert report.criteria["keys_and_constraints"].marks_earned < 25.0
        assert any("Table 'Student' is missing a Primary Key." in c for c in report.criteria["keys_and_constraints"].failed_checks)
        assert any("Define a primary key on table 'Student'" in s for s in report.suggestions)


# ══════════════════════════════════════════════════════════════════════════════
#  3. Error Handling & Report Serialization
# ══════════════════════════════════════════════════════════════════════════════

class TestScorerErrorHandling:
    def test_malformed_diagram_returns_rejected_report(self):
        spec = make_student_course_spec("q1")
        bad_doc = {"tables": []}  # empty diagram

        report = evaluate_submission(spec, bad_doc)

        assert report.is_valid is False
        assert report.status == "rejected"
        assert report.percentage == 0.0
        assert len(report.diagram_errors) > 0
        assert len(report.suggestions) > 0

    def test_report_to_dict_format(self):
        doc = make_canonical_student_course_diagram()
        spec = make_student_course_spec("q1")

        report = evaluate_submission(spec, doc)
        d = report.to_dict()

        assert "is_valid" in d
        assert "total_marks_earned" in d
        assert "percentage" in d
        assert "criteria" in d
        assert "entities_and_attributes" in d["criteria"]
        assert "behavioral_test_results" in d
        assert d["behavioral_test_results"]["total_marks_earned"] == 25.0
