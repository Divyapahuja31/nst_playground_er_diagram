"""
Unit and integration tests for Phase 4 — Automated SQL Test Generator & Runner.

Covers:
  - Dynamic EntityResolver matching (case, plural/singular, PK aliases, junction heuristics)
  - Full behavioral test suite execution against a correct Student-Course schema
  - Proper detection and failing of schemas that omit Foreign Keys (negative test detection)
  - Proper detection and failing of schemas that omit Composite Primary Keys (duplicate rejection failure)
  - Handling schemas missing required entities
  - Strict test isolation between consecutive tests
  - Multi-operation cardinality participation tests (1:M, M:1)
"""

import pytest

from app.query_validator.converter import (
    Column,
    ForeignKey,
    RelationalSchema,
    Table,
    convert_diagram_to_relational,
)
from app.query_validator.spec import (
    QuestionSpec,
    SqlTestSpec,
    make_student_course_spec,
)
from app.query_validator.tester import (
    EntityResolver,
    TestOutcome,
    TestSuiteResult,
    run_behavioral_tests,
    run_single_sql_test,
)
from tests.test_converter import make_canonical_student_course_diagram


# ══════════════════════════════════════════════════════════════════════════════
#  1. EntityResolver Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestEntityResolver:
    def test_exact_and_case_insensitive_matching(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)
        resolver = EntityResolver(schema)

        assert resolver.resolve_table("Student") is not None
        assert resolver.resolve_table("student") is not None
        assert resolver.resolve_table("STUDENT") is not None
        assert resolver.resolve_table("NonExistent") is None

    def test_plural_singular_matching(self):
        # Schema with plural table name "Students"
        schema = RelationalSchema(
            tables=[
                Table(name="Students", columns=[Column(name="student_id", data_type="INTEGER")]),
            ]
        )
        resolver = EntityResolver(schema)
        # Spec asks for "Student" -> resolves to "Students"
        resolved = resolver.resolve_table("Student")
        assert resolved is not None
        assert resolved.name == "Students"

    def test_junction_reversed_matching(self):
        # Schema with "Course_Student" instead of "Student_Course"
        schema = RelationalSchema(
            tables=[
                Table(name="Course_Student", columns=[
                    Column(name="course_id", data_type="INTEGER"),
                    Column(name="student_id", data_type="INTEGER"),
                ]),
            ]
        )
        resolver = EntityResolver(schema)
        resolved = resolver.resolve_table("Student_Course")
        assert resolved is not None
        assert resolved.name == "Course_Student"

    def test_column_pk_alias_matching(self):
        # Table "Student" with column "id" instead of "student_id"
        table = Table(name="Student", columns=[Column(name="id", data_type="INTEGER", is_primary_key=True)])
        schema = RelationalSchema(tables=[table])
        resolver = EntityResolver(schema)

        col = resolver.resolve_column(table, "student_id")
        assert col is not None
        assert col.name == "id"


# ══════════════════════════════════════════════════════════════════════════════
#  2. Behavioral Execution on Correct Schema
# ══════════════════════════════════════════════════════════════════════════════

class TestBehavioralExecutionCorrectSchema:
    def test_all_canonical_tests_pass_on_correct_schema(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)
        spec = make_student_course_spec("q1")

        result: TestSuiteResult = run_behavioral_tests(spec, schema)

        assert len(result.failed_tests) == 0
        assert len(result.passed_tests) == len(spec.sql_tests)
        assert result.total_marks_earned == 25.0
        assert result.total_marks_possible == 25.0

        for outcome in result.passed_tests:
            assert outcome.passed is True
            assert outcome.marks_earned == outcome.marks_possible


# ══════════════════════════════════════════════════════════════════════════════
#  3. Detection of Broken / Incomplete Schemas
# ══════════════════════════════════════════════════════════════════════════════

class TestDetectionOfBrokenSchemas:
    def test_schema_missing_foreign_keys_fails_rejection_tests(self):
        """
        Student created Student_Course table, but forgot foreign key constraints!
        Invalid student and invalid course tests should FAIL because the database
        accepted the invalid rows.
        """
        schema = RelationalSchema(
            tables=[
                Table(
                    name="Student",
                    columns=[
                        Column(name="student_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                        Column(name="name", data_type="VARCHAR", is_not_null=True),
                    ],
                    primary_key=["student_id"],
                ),
                Table(
                    name="Course",
                    columns=[
                        Column(name="course_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                        Column(name="title", data_type="VARCHAR", is_not_null=True),
                    ],
                    primary_key=["course_id"],
                ),
                Table(
                    name="Student_Course",
                    columns=[
                        Column(name="student_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                        Column(name="course_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                    ],
                    primary_key=["student_id", "course_id"],
                    # NOTE: No foreign_keys defined!
                    foreign_keys=[],
                ),
            ]
        )
        spec = make_student_course_spec("q1")
        result = run_behavioral_tests(spec, schema)

        # Expected:
        # - insert_valid_student passes
        # - insert_valid_course passes
        # - enroll_student_in_course passes
        # - duplicate_enrollment_rejected passes (composite PK is present)
        # - enroll_nonexistent_student_rejected FAILS (FK missing)
        # - enroll_nonexistent_course_rejected FAILS (FK missing)
        failed_names = [t.test_name for t in result.failed_tests]
        assert "enroll_nonexistent_student_rejected" in failed_names
        assert "enroll_nonexistent_course_rejected" in failed_names

        for f in result.failed_tests:
            assert "missing a required UNIQUE, PRIMARY KEY, or FOREIGN KEY constraint" in f.message

    def test_schema_missing_composite_pk_fails_duplicate_rejection(self):
        """
        Student created Student_Course with FKs, but made student_id alone the PK
        or forgot the composite PK entirely, allowing duplicate enrollments.
        """
        schema = RelationalSchema(
            tables=[
                Table(
                    name="Student",
                    columns=[
                        Column(name="student_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                        Column(name="name", data_type="VARCHAR", is_not_null=True),
                    ],
                    primary_key=["student_id"],
                ),
                Table(
                    name="Course",
                    columns=[
                        Column(name="course_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                        Column(name="title", data_type="VARCHAR", is_not_null=True),
                    ],
                    primary_key=["course_id"],
                ),
                Table(
                    name="Student_Course",
                    columns=[
                        # Auto-increment surrogate id as PK, no uniqueness on (student_id, course_id)
                        Column(name="id", data_type="INTEGER", is_primary_key=True, is_auto_increment=True),
                        Column(name="student_id", data_type="INTEGER", is_not_null=True),
                        Column(name="course_id", data_type="INTEGER", is_not_null=True),
                    ],
                    primary_key=["id"],
                    foreign_keys=[
                        ForeignKey(columns=["student_id"], ref_table="Student", ref_columns=["student_id"]),
                        ForeignKey(columns=["course_id"], ref_table="Course", ref_columns=["course_id"]),
                    ],
                ),
            ]
        )
        spec = make_student_course_spec("q1")
        result = run_behavioral_tests(spec, schema)

        failed_names = [t.test_name for t in result.failed_tests]
        assert "duplicate_enrollment_rejected" in failed_names
        # FK tests should pass because FKs are present
        passed_names = [t.test_name for t in result.passed_tests]
        assert "enroll_nonexistent_student_rejected" in passed_names
        assert "enroll_nonexistent_course_rejected" in passed_names

    def test_missing_required_entity(self):
        """Schema only has Student, completely missing Course."""
        schema = RelationalSchema(
            tables=[
                Table(
                    name="Student",
                    columns=[
                        Column(name="student_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                        Column(name="name", data_type="VARCHAR", is_not_null=True),
                    ],
                    primary_key=["student_id"],
                ),
            ]
        )
        spec = make_student_course_spec("q1")
        result = run_behavioral_tests(spec, schema)

        failed_names = [t.test_name for t in result.failed_tests]
        assert "insert_valid_course" in failed_names
        assert "enroll_student_in_course" in failed_names
        # Student test should still pass
        passed_names = [t.test_name for t in result.passed_tests]
        assert "insert_valid_student" in passed_names


# ══════════════════════════════════════════════════════════════════════════════
#  4. Test Isolation & Cardinality Multi-Operation Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestIsolationAndCardinality:
    def test_tests_do_not_interfere_with_each_other(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)

        # Run test 1 which inserts student 1
        spec1 = QuestionSpec(
            question_id="q1",
            entities=[],
            sql_tests=[
                SqlTestSpec(
                    name="t1",
                    description="Insert Alice",
                    kind="insert_valid",
                    operation={"entity": "Student", "row": {"student_id": 1, "name": "Alice"}},
                    expect_success=True,
                    marks=5.0,
                ),
            ],
        )
        # Run test 2 which inserts student 1 AGAIN as a fresh operation
        spec2 = QuestionSpec(
            question_id="q1",
            entities=[],
            sql_tests=[
                SqlTestSpec(
                    name="t2",
                    description="Insert Alice in fresh sandbox",
                    kind="insert_valid",
                    operation={"entity": "Student", "row": {"student_id": 1, "name": "Alice"}},
                    expect_success=True,
                    marks=5.0,
                ),
            ],
        )

        res1 = run_behavioral_tests(spec1, schema)
        res2 = run_behavioral_tests(spec2, schema)

        assert res1.all_tests[0].passed is True
        # If isolation worked, res2 did not see Alice from res1 and passed cleanly
        assert res2.all_tests[0].passed is True

    def test_multi_operation_cardinality_enrollment(self):
        """Verifies 1 student enrolled in 2 courses, and 1 course with 2 students."""
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)

        spec = QuestionSpec(
            question_id="q1",
            entities=[],
            sql_tests=[
                SqlTestSpec(
                    name="student_multiple_courses",
                    description="One student can enroll in multiple courses",
                    kind="multi_operation",
                    setup={
                        "Student": [{"student_id": 1, "name": "Alice"}],
                        "Course": [
                            {"course_id": 101, "title": "Databases"},
                            {"course_id": 102, "title": "Operating Systems"},
                        ],
                    },
                    operation={
                        "operations": [
                            {"entity": "Student_Course", "row": {"student_id": 1, "course_id": 101}},
                            {"entity": "Student_Course", "row": {"student_id": 1, "course_id": 102}},
                        ]
                    },
                    expect_success=True,
                    marks=5.0,
                ),
                SqlTestSpec(
                    name="course_multiple_students",
                    description="One course can have multiple students",
                    kind="multi_operation",
                    setup={
                        "Student": [
                            {"student_id": 1, "name": "Alice"},
                            {"student_id": 2, "name": "Bob"},
                        ],
                        "Course": [{"course_id": 101, "title": "Databases"}],
                    },
                    operation={
                        "operations": [
                            {"entity": "Student_Course", "row": {"student_id": 1, "course_id": 101}},
                            {"entity": "Student_Course", "row": {"student_id": 2, "course_id": 101}},
                        ]
                    },
                    expect_success=True,
                    marks=5.0,
                ),
            ],
        )

        result = run_behavioral_tests(spec, schema)
        assert len(result.failed_tests) == 0
        assert len(result.passed_tests) == 2
        assert result.total_marks_earned == 10.0
