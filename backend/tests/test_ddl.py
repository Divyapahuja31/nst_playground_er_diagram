"""
Unit and integration tests for Phase 3 — SQL DDL Generator and Sandbox Execution.

Covers:
  - Safe identifier quoting and default value formatting
  - Column definition and table DDL generation
  - Topological table sorting for foreign key dependencies
  - Schema DDL generation
  - Isolated in-memory SQLite sandbox execution
  - Real foreign key constraint enforcement in SQLite sandbox
  - Check constraint and unique constraint validation in sandbox
"""

import pytest

from app.query_validator.converter import (
    Column,
    ForeignKey,
    RelationalSchema,
    Table,
    convert_diagram_to_relational,
)
from app.query_validator.ddl import (
    format_default_value,
    generate_column_def,
    generate_create_table_sql,
    generate_schema_ddl,
    quote_identifier,
    sort_tables_topologically,
)
from app.query_validator.sandbox import (
    SandboxDatabase,
    SandboxExecutionError,
)
from tests.test_converter import make_canonical_student_course_diagram


# ══════════════════════════════════════════════════════════════════════════════
#  1. Helper & Formatting Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestDdlHelpers:
    def test_quote_identifier(self):
        assert quote_identifier("users") == '"users"'
        assert quote_identifier('my"table') == '"my""table"'
        assert quote_identifier("Student_Course") == '"Student_Course"'

    def test_format_default_value(self):
        assert format_default_value(None) is None
        assert format_default_value("") is None
        assert format_default_value("CURRENT_TIMESTAMP") == "CURRENT_TIMESTAMP"
        assert format_default_value("NULL") == "NULL"
        assert format_default_value("TRUE") == "TRUE"
        assert format_default_value("42") == "42"
        assert format_default_value("-10") == "-10"
        assert format_default_value("19.99") == "19.99"
        assert format_default_value("active") == "'active'"
        assert format_default_value("O'Connor") == "'O''Connor'"


# ══════════════════════════════════════════════════════════════════════════════
#  2. Column and Table DDL Generation
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateDdl:
    def test_generate_column_def_single_pk(self):
        col = Column(name="id", data_type="INTEGER", is_primary_key=True, is_not_null=True)
        res = generate_column_def(col, is_composite_pk=False)
        assert res == '"id" INTEGER PRIMARY KEY'

    def test_generate_column_def_with_flags(self):
        col = Column(
            name="email",
            data_type="VARCHAR(255)",
            is_not_null=True,
            is_unique=True,
            default_value="user@example.com",
            check_expr='length("email") > 5',
        )
        res = generate_column_def(col)
        assert '"email" VARCHAR(255)' in res
        assert "NOT NULL" in res
        assert "UNIQUE" in res
        assert "DEFAULT 'user@example.com'" in res
        assert 'CHECK (length("email") > 5)' in res

    def test_generate_create_table_sql_composite_pk(self):
        table = Table(
            name="Enrollment",
            columns=[
                Column(name="student_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
                Column(name="course_id", data_type="INTEGER", is_primary_key=True, is_not_null=True),
            ],
            primary_key=["student_id", "course_id"],
            foreign_keys=[
                ForeignKey(
                    columns=["student_id"],
                    ref_table="Student",
                    ref_columns=["id"],
                    on_delete="CASCADE",
                ),
            ],
        )
        ddl = generate_create_table_sql(table)
        assert 'CREATE TABLE "Enrollment"' in ddl
        assert 'PRIMARY KEY ("student_id", "course_id")' in ddl
        assert 'FOREIGN KEY ("student_id") REFERENCES "Student" ("id") ON DELETE CASCADE' in ddl

    def test_sort_tables_topologically(self):
        # Child defined before parent
        child = Table(
            name="Order",
            foreign_keys=[ForeignKey(columns=["user_id"], ref_table="User", ref_columns=["id"])],
        )
        parent = Table(name="User", primary_key=["id"])

        sorted_tables = sort_tables_topologically([child, parent])
        assert [t.name for t in sorted_tables] == ["User", "Order"]

    def test_generate_schema_ddl_orders_parents_first(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)
        ddl = generate_schema_ddl(schema)

        # Student_Course must be created AFTER Student and Course
        pos_student = ddl.find('CREATE TABLE "Student"')
        pos_course = ddl.find('CREATE TABLE "Course"')
        pos_junction = ddl.find('CREATE TABLE "Student_Course"')

        assert pos_student != -1
        assert pos_course != -1
        assert pos_junction != -1
        assert pos_student < pos_junction
        assert pos_course < pos_junction


# ══════════════════════════════════════════════════════════════════════════════
#  3. Sandbox Execution & Constraint Enforcement
# ══════════════════════════════════════════════════════════════════════════════

class TestSandboxExecution:
    def test_execute_valid_schema_in_sandbox(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)
        ddl = generate_schema_ddl(schema)

        with SandboxDatabase() as db:
            db.execute_ddl(ddl)

            # Inspect created tables
            tables = db.get_tables()
            assert "Course" in tables
            assert "Student" in tables
            assert "Student_Course" in tables

            # Inspect columns of Student
            cols = db.get_table_columns("Student")
            col_names = [c["name"] for c in cols]
            assert "student_id" in col_names
            assert "name" in col_names

            # Inspect foreign keys on Student_Course
            fks = db.get_foreign_keys("Student_Course")
            ref_tables = {fk["table"] for fk in fks}
            assert "Student" in ref_tables
            assert "Course" in ref_tables

    def test_foreign_key_enforcement_in_sandbox(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)
        ddl = generate_schema_ddl(schema)

        with SandboxDatabase() as db:
            db.execute_ddl(ddl)

            # 1. Insert parent rows
            db.execute_statement('INSERT INTO "Student" ("student_id", "name") VALUES (1, "Alice");')
            db.execute_statement('INSERT INTO "Course" ("course_id", "title") VALUES (101, "Databases");')

            # 2. Insert valid junction row -> succeeds
            affected = db.execute_statement(
                'INSERT INTO "Student_Course" ("student_id", "course_id") VALUES (1, 101);'
            )
            assert affected == 1

            # 3. Insert invalid junction row (referencing nonexistent course) -> fails FK check
            with pytest.raises(SandboxExecutionError) as exc_info:
                db.execute_statement(
                    'INSERT INTO "Student_Course" ("student_id", "course_id") VALUES (1, 999);'
                )
            assert "FOREIGN KEY constraint failed" in str(exc_info.value)

            # 4. Insert invalid junction row (referencing nonexistent student) -> fails FK check
            with pytest.raises(SandboxExecutionError) as exc_info:
                db.execute_statement(
                    'INSERT INTO "Student_Course" ("student_id", "course_id") VALUES (999, 101);'
                )
            assert "FOREIGN KEY constraint failed" in str(exc_info.value)

    def test_primary_key_uniqueness_enforcement(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)
        ddl = generate_schema_ddl(schema)

        with SandboxDatabase() as db:
            db.execute_ddl(ddl)
            db.execute_statement('INSERT INTO "Student" ("student_id", "name") VALUES (1, "Alice");')

            # Duplicate PK should fail
            with pytest.raises(SandboxExecutionError) as exc_info:
                db.execute_statement('INSERT INTO "Student" ("student_id", "name") VALUES (1, "Bob");')
            assert "UNIQUE constraint failed" in str(exc_info.value)

    def test_check_constraint_enforcement(self):
        table = Table(
            name="Person",
            columns=[
                Column(name="id", data_type="INTEGER", is_primary_key=True),
                Column(name="age", data_type="INTEGER", check_expr='"age" >= 18'),
            ],
            primary_key=["id"],
        )
        ddl = generate_create_table_sql(table)

        with SandboxDatabase() as db:
            db.execute_ddl(ddl)

            # Valid age >= 18 -> succeeds
            db.execute_statement('INSERT INTO "Person" ("id", "age") VALUES (1, 20);')

            # Invalid age < 18 -> fails CHECK constraint
            with pytest.raises(SandboxExecutionError) as exc_info:
                db.execute_statement('INSERT INTO "Person" ("id", "age") VALUES (2, 16);')
            assert "CHECK constraint failed" in str(exc_info.value)

    def test_invalid_ddl_raises_sandbox_execution_error(self):
        bad_ddl = 'CREATE TABLE "broken" (id INT, broken syntax here !!!);'
        with SandboxDatabase() as db:
            with pytest.raises(SandboxExecutionError) as exc_info:
                db.execute_ddl(bad_ddl)
            assert "DDL execution failed" in str(exc_info.value)
