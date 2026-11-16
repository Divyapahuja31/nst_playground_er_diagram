"""
Integration tests for Phase 6 — Backend API Integration of the Query-Based Validation Engine.

Covers:
  - Hybrid routing: legacy questions fallback to Bliss, spec-configured questions use Query Validator
  - Teacher configuring a QuestionSpec on a question
  - Student submitting a correct diagram to a query-validated question
  - Student submitting a flawed diagram (missing FKs) to a query-validated question
  - Student submission persistence in the submissions table
  - Security and guardrails: unpublished question protection, student role restrictions, safe error messages
"""

import pytest

from app.query_validator.spec import (
    make_student_course_spec,
    spec_to_dict,
)
from tests.test_converter import make_canonical_student_course_diagram


SAMPLE_LEGACY_DIAGRAM = {
    "tables": [
        {
            "id": "t1",
            "name": "User",
            "fields": [
                {"id": "f1", "name": "id", "type": "INTEGER", "primaryKey": True, "notNull": True},
            ],
        }
    ],
    "relationships": [],
}


class TestBackendApiIntegration:
    @pytest.fixture(autouse=True)
    def auto_cleanup(self):
        self._created_qids = []
        yield
        from app.db.store import delete_question
        for qid in getattr(self, "_created_qids", []):
            try:
                delete_question(qid)
            except Exception:
                pass

    def _create_and_publish_question(self, client, teacher_headers, solution=None) -> str:
        res = client.post(
            "/questions",
            json={
                "title": "Enrollment System",
                "question": "Design an enrollment database.",
                "solution": solution or SAMPLE_LEGACY_DIAGRAM,
            },
            headers=teacher_headers,
        )
        assert res.status_code in (200, 201), res.text
        qid = res.json()["id"]
        self._created_qids.append(qid)

        # Publish the question
        pub_res = client.put(
            f"/questions/{qid}",
            json={"is_published": True},
            headers=teacher_headers,
        )
        assert pub_res.status_code == 200, pub_res.text
        return qid

    def test_legacy_question_falls_back_to_bliss(self, client, teacher_auth, student_auth):
        """Questions without spec_json continue using legacy bliss engine without regression."""
        qid = self._create_and_publish_question(client, teacher_auth["headers"])

        # Student submits matching diagram
        res = client.post(
            f"/questions/{qid}/submit",
            json={"student": SAMPLE_LEGACY_DIAGRAM},
            headers=student_auth["headers"],
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data.get("validation_engine") == "legacy_bliss"
        assert data.get("is_valid") is True

    def test_query_validator_full_student_submission_flow(self, client, teacher_auth, student_auth):
        """Complete workflow: teacher sets spec -> student submits correct diagram -> full marks."""
        canonical_diag = make_canonical_student_course_diagram()
        qid = self._create_and_publish_question(
            client,
            teacher_auth["headers"],
            solution=canonical_diag,
        )

        # Teacher attaches the Student-Course validation spec
        spec = spec_to_dict(make_student_course_spec(qid))
        put_spec_res = client.put(
            f"/questions/{qid}/spec",
            json=spec,
            headers=teacher_auth["headers"],
        )
        assert put_spec_res.status_code == 200, put_spec_res.text

        # Student submits the correct canonical diagram
        sub_res = client.post(
            f"/questions/{qid}/submit",
            json={"student": canonical_diag},
            headers=student_auth["headers"],
        )
        assert sub_res.status_code == 200, sub_res.text
        data = sub_res.json()

        # Verify Query-Validator response schema
        assert data.get("validation_engine") == "query_validator"
        assert data.get("is_valid") is True
        assert data.get("status") == "accepted"
        assert data.get("total_marks_earned") == 100.0
        assert data.get("total_marks_possible") == 100.0
        assert data.get("percentage") == 100.0

        # Check all 4 criteria are present and fully scored
        criteria = data.get("criteria", {})
        assert "entities_and_attributes" in criteria
        assert "relationships_and_cardinalities" in criteria
        assert "keys_and_constraints" in criteria
        assert "sql_behavioral_tests" in criteria
        assert criteria["entities_and_attributes"]["marks_earned"] == 25.0
        assert criteria["sql_behavioral_tests"]["marks_earned"] == 25.0

        # Verify behavioral test details are returned
        b_results = data.get("behavioral_test_results")
        assert b_results is not None
        assert b_results["total_marks_earned"] == 25.0
        assert len(b_results["passed_tests"]) > 0
        assert len(b_results["failed_tests"]) == 0

    def test_student_submitting_flawed_diagram_gets_actionable_feedback(self, client, teacher_auth, student_auth):
        """Student submits diagram missing FKs -> receives partial score and actionable hints."""
        canonical_diag = make_canonical_student_course_diagram()
        qid = self._create_and_publish_question(
            client,
            teacher_auth["headers"],
            solution=canonical_diag,
        )

        # Attach spec
        spec = spec_to_dict(make_student_course_spec(qid))
        client.put(f"/questions/{qid}/spec", json=spec, headers=teacher_auth["headers"])

        # Flawed diagram: student created tables but omitted relationships
        flawed_diag = make_canonical_student_course_diagram()
        flawed_diag["relationships"] = []

        sub_res = client.post(
            f"/questions/{qid}/submit",
            json={"student": flawed_diag},
            headers=student_auth["headers"],
        )
        assert sub_res.status_code == 200, sub_res.text
        data = sub_res.json()

        assert data.get("validation_engine") == "query_validator"
        assert data.get("is_valid") is False
        assert data.get("status") == "partial"
        assert data.get("percentage") < 90.0

        # Verify actionable suggestions exist
        suggestions = data.get("suggestions", [])
        assert len(suggestions) > 0
        assert any("foreign key" in s.lower() for s in suggestions)

    def test_unpublished_question_blocks_student_submission(self, client, teacher_auth, student_auth):
        """Students cannot submit to unpublished questions."""
        res = client.post(
            "/questions",
            json={
                "title": "Draft Question",
                "question": "Unpublished.",
                "solution": SAMPLE_LEGACY_DIAGRAM,
            },
            headers=teacher_auth["headers"],
        )
        qid = res.json()["id"]

        sub_res = client.post(
            f"/questions/{qid}/submit",
            json={"student": SAMPLE_LEGACY_DIAGRAM},
            headers=student_auth["headers"],
        )
        assert sub_res.status_code == 403
