"""
Unit tests for Phase 2 — Diagram-to-Relational Converter.

Covers:
  - Diagram structural validation (syntax, naming, endpoints, duplicate checks)
  - Mapping tables, columns, data types, defaults, and check constraints
  - Cardinality-to-ForeignKey resolution (many_to_one, one_to_many, one_to_one)
  - Junction table handling (explicit junction tables and direct M:N synthesis)
  - Serialization round-trip (schema_to_dict / schema_from_dict)
"""

import pytest

from app.query_validator.converter import (
    Column,
    DiagramValidationError,
    ForeignKey,
    RelationalSchema,
    Table,
    build_check_expression,
    convert_diagram_to_relational,
    is_valid_identifier,
    normalize_data_type,
    sanitize_identifier,
    schema_from_dict,
    schema_to_dict,
    validate_diagram_structure,
)


# ══════════════════════════════════════════════════════════════════════════════
#  Test Fixtures
# ══════════════════════════════════════════════════════════════════════════════

def make_canonical_student_course_diagram() -> dict:
    """Explicit relational 3-table design with Student_Course junction table."""
    return {
        "tables": [
            {
                "id": "t1",
                "name": "Student",
                "fields": [
                    {"id": "f1", "name": "student_id", "type": "INTEGER", "primaryKey": True, "notNull": True, "unique": True, "increment": False, "def": "", "checkConstraint": None},
                    {"id": "f2", "name": "name", "type": "VARCHAR", "primaryKey": False, "notNull": True, "unique": False, "increment": False, "def": "", "checkConstraint": None},
                ],
            },
            {
                "id": "t2",
                "name": "Course",
                "fields": [
                    {"id": "f3", "name": "course_id", "type": "INTEGER", "primaryKey": True, "notNull": True, "unique": True, "increment": False, "def": "", "checkConstraint": None},
                    {"id": "f4", "name": "title", "type": "VARCHAR", "primaryKey": False, "notNull": True, "unique": False, "increment": False, "def": "", "checkConstraint": None},
                ],
            },
            {
                "id": "t3",
                "name": "Student_Course",
                "fields": [
                    {"id": "f5", "name": "student_id", "type": "INTEGER", "primaryKey": True, "notNull": True, "unique": False, "increment": False, "def": "", "checkConstraint": None},
                    {"id": "f6", "name": "course_id", "type": "INTEGER", "primaryKey": True, "notNull": True, "unique": False, "increment": False, "def": "", "checkConstraint": None},
                ],
            },
        ],
        "relationships": [
            {
                "id": "r1",
                "startTable": "t3",
                "startField": "f5",
                "endTable": "t1",
                "endField": "f1",
                "cardinality": "many_to_one",
            },
            {
                "id": "r2",
                "startTable": "t3",
                "startField": "f6",
                "endTable": "t2",
                "endField": "f3",
                "cardinality": "many_to_one",
            },
        ],
    }


def make_direct_m2m_diagram() -> dict:
    """Conceptual 2-table diagram with a direct M:N relationship."""
    return {
        "tables": [
            {
                "id": "t1",
                "name": "Student",
                "fields": [
                    {"id": "f1", "name": "student_id", "type": "INTEGER", "primaryKey": True, "notNull": True, "unique": True, "increment": False, "def": "", "checkConstraint": None},
                    {"id": "f2", "name": "name", "type": "VARCHAR", "primaryKey": False, "notNull": True, "unique": False, "increment": False, "def": "", "checkConstraint": None},
                ],
            },
            {
                "id": "t2",
                "name": "Course",
                "fields": [
                    {"id": "f3", "name": "course_id", "type": "INTEGER", "primaryKey": True, "notNull": True, "unique": True, "increment": False, "def": "", "checkConstraint": None},
                    {"id": "f4", "name": "title", "type": "VARCHAR", "primaryKey": False, "notNull": True, "unique": False, "increment": False, "def": "", "checkConstraint": None},
                ],
            },
        ],
        "relationships": [
            {
                "id": "r1",
                "startTable": "t1",
                "startField": "f1",
                "endTable": "t2",
                "endField": "f3",
                "cardinality": "many_to_many",
            },
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  1. Helper & Identifier Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestIdentifierAndTypeHelpers:
    def test_valid_identifier(self):
        assert is_valid_identifier("users") is True
        assert is_valid_identifier("Student_Course") is True
        assert is_valid_identifier("_hidden_id") is True
        assert is_valid_identifier("col123") is True
        assert is_valid_identifier("123col") is False
        assert is_valid_identifier("user-name") is False
        assert is_valid_identifier("user name") is False
        assert is_valid_identifier("drop table;") is False

    def test_sanitize_identifier(self):
        assert sanitize_identifier("student name") == "student_name"
        assert sanitize_identifier("course-id") == "course_id"
        assert sanitize_identifier("123bad") == "_123bad"
        assert sanitize_identifier("table;--") == "table"

    def test_normalize_data_type(self):
        assert normalize_data_type("int") == "INTEGER"
        assert normalize_data_type("INTEGER") == "INTEGER"
        assert normalize_data_type("varchar") == "VARCHAR(255)"
        assert normalize_data_type("bool") == "BOOLEAN"
        assert normalize_data_type("timestamp") == "TIMESTAMP"
        assert normalize_data_type("custom_type") == "CUSTOM_TYPE"

    def test_build_check_expression(self):
        check = {
            "conditions": [
                {"left": "age", "operator": ">=", "right": "18"},
                {"connector": "AND"},
                {"left": "age", "operator": "<=", "right": "100"},
            ]
        }
        res = build_check_expression(check, {"age"})
        assert res == "age >= 18 AND age <= 100"

    def test_build_check_expression_string_value(self):
        check = {
            "conditions": [
                {"left": "status", "operator": "=", "right": "active"},
            ]
        }
        res = build_check_expression(check, {"status"})
        assert res == "status = 'active'"


# ══════════════════════════════════════════════════════════════════════════════
#  2. Diagram Structural Validation Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestValidateDiagramStructure:
    def test_valid_canonical_diagram_passes(self):
        doc = make_canonical_student_course_diagram()
        errors = validate_diagram_structure(doc)
        assert errors == []

    def test_non_dict_rejected(self):
        assert "JSON object" in validate_diagram_structure("not a dict")[0]

    def test_missing_tables_rejected(self):
        errors = validate_diagram_structure({})
        assert any("missing 'tables'" in e for e in errors)

    def test_empty_tables_rejected(self):
        errors = validate_diagram_structure({"tables": []})
        assert any("at least one table" in e for e in errors)

    def test_duplicate_table_name_rejected(self):
        doc = {
            "tables": [
                {"id": "t1", "name": "User", "fields": [{"id": "f1", "name": "id", "type": "int"}]},
                {"id": "t2", "name": "user", "fields": [{"id": "f2", "name": "id", "type": "int"}]},
            ]
        }
        errors = validate_diagram_structure(doc)
        assert any("Duplicate table name" in e for e in errors)

    def test_table_without_fields_rejected(self):
        doc = {
            "tables": [
                {"id": "t1", "name": "EmptyTable", "fields": []}
            ]
        }
        errors = validate_diagram_structure(doc)
        assert any("has no fields" in e for e in errors)

    def test_duplicate_field_name_in_table_rejected(self):
        doc = {
            "tables": [
                {
                    "id": "t1",
                    "name": "User",
                    "fields": [
                        {"id": "f1", "name": "email", "type": "varchar"},
                        {"id": "f2", "name": "email", "type": "varchar"},
                    ],
                }
            ]
        }
        errors = validate_diagram_structure(doc)
        assert any("Duplicate field 'email'" in e for e in errors)

    def test_relationship_unknown_start_table_rejected(self):
        doc = make_canonical_student_course_diagram()
        doc["relationships"][0]["startTable"] = "nonexistent_table"
        errors = validate_diagram_structure(doc)
        assert any("non-existent startTable" in e for e in errors)

    def test_relationship_unknown_field_rejected(self):
        doc = make_canonical_student_course_diagram()
        doc["relationships"][0]["startField"] = "nonexistent_field"
        errors = validate_diagram_structure(doc)
        assert any("non-existent startField" in e for e in errors)

    def test_relationship_invalid_cardinality_rejected(self):
        doc = make_canonical_student_course_diagram()
        doc["relationships"][0]["cardinality"] = "invalid_card"
        errors = validate_diagram_structure(doc)
        assert any("invalid cardinality" in e for e in errors)


# ══════════════════════════════════════════════════════════════════════════════
#  3. Diagram-to-Relational Conversion Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestConvertDiagramToRelational:
    def test_canonical_student_course_conversion(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)

        table_names = schema.table_names()
        assert "Student" in table_names
        assert "Course" in table_names
        assert "Student_Course" in table_names

        student_tbl = schema.get_table("Student")
        assert student_tbl is not None
        assert student_tbl.primary_key == ["student_id"]
        sid_col = student_tbl.get_column("student_id")
        assert sid_col is not None
        assert sid_col.is_primary_key is True
        assert sid_col.is_not_null is True

        junction_tbl = schema.get_table("Student_Course")
        assert junction_tbl is not None
        assert set(junction_tbl.primary_key) == {"student_id", "course_id"}
        assert len(junction_tbl.foreign_keys) == 2

        # Verify foreign keys on junction table
        fk_map = {fk.columns[0]: fk for fk in junction_tbl.foreign_keys}
        assert "student_id" in fk_map
        assert fk_map["student_id"].ref_table == "Student"
        assert fk_map["student_id"].ref_columns == ["student_id"]

        assert "course_id" in fk_map
        assert fk_map["course_id"].ref_table == "Course"
        assert fk_map["course_id"].ref_columns == ["course_id"]

    def test_direct_m2m_junction_synthesis(self):
        doc = make_direct_m2m_diagram()
        schema = convert_diagram_to_relational(doc, synthesize_m2m_junctions=True)

        table_names = schema.table_names()
        assert "Student" in table_names
        assert "Course" in table_names
        # Should have synthesized Student_Course
        assert "Student_Course" in table_names

        synth_tbl = schema.get_table("Student_Course")
        assert synth_tbl.is_synthetic is True
        assert set(synth_tbl.primary_key) == {"student_id", "course_id"}
        assert len(synth_tbl.foreign_keys) == 2
        assert any("Synthesized relational junction table" in w for w in schema.warnings)

    def test_direct_m2m_with_existing_junction_table_does_not_duplicate(self):
        doc = make_canonical_student_course_diagram()
        # Add a redundant direct M:N edge between Student and Course
        doc["relationships"].append({
            "id": "r_redundant",
            "startTable": "t1",
            "startField": "f1",
            "endTable": "t2",
            "endField": "f3",
            "cardinality": "many_to_many",
        })
        schema = convert_diagram_to_relational(doc, synthesize_m2m_junctions=True)
        # Should keep existing Student_Course and not create a duplicate
        assert schema.table_names().count("Student_Course") == 1
        assert any("skipped because explicit junction table already exists" in w for w in schema.warnings)

    def test_one_to_one_relationship(self):
        doc = {
            "tables": [
                {
                    "id": "t1",
                    "name": "User",
                    "fields": [
                        {"id": "f1", "name": "user_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                    ],
                },
                {
                    "id": "t2",
                    "name": "Profile",
                    "fields": [
                        {"id": "f2", "name": "profile_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                        {"id": "f3", "name": "user_id", "type": "INTEGER", "primaryKey": False, "notNull": True},
                    ],
                },
            ],
            "relationships": [
                {
                    "id": "r1",
                    "startTable": "t2",
                    "startField": "f3",
                    "endTable": "t1",
                    "endField": "f1",
                    "cardinality": "one_to_one",
                }
            ],
        }
        schema = convert_diagram_to_relational(doc)
        profile_tbl = schema.get_table("Profile")
        assert len(profile_tbl.foreign_keys) == 1
        fk = profile_tbl.foreign_keys[0]
        assert fk.columns == ["user_id"]
        assert fk.ref_table == "User"
        # 1:1 requires uniqueness on child column
        assert profile_tbl.get_column("user_id").is_unique is True

    def test_one_to_many_relationship(self):
        doc = {
            "tables": [
                {
                    "id": "t1",
                    "name": "Department",
                    "fields": [
                        {"id": "f1", "name": "dept_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                    ],
                },
                {
                    "id": "t2",
                    "name": "Employee",
                    "fields": [
                        {"id": "f2", "name": "emp_id", "type": "INTEGER", "primaryKey": True, "notNull": True},
                        {"id": "f3", "name": "dept_id", "type": "INTEGER", "primaryKey": False, "notNull": True},
                    ],
                },
            ],
            "relationships": [
                {
                    "id": "r1",
                    "startTable": "t1",  # Department is "one"
                    "startField": "f1",
                    "endTable": "t2",    # Employee is "many"
                    "endField": "f3",
                    "cardinality": "one_to_many",
                }
            ],
        }
        schema = convert_diagram_to_relational(doc)
        emp_tbl = schema.get_table("Employee")
        assert len(emp_tbl.foreign_keys) == 1
        fk = emp_tbl.foreign_keys[0]
        assert fk.columns == ["dept_id"]
        assert fk.ref_table == "Department"
        assert fk.ref_columns == ["dept_id"]

    def test_invalid_diagram_raises_diagram_validation_error(self):
        bad_doc = {"tables": []}
        with pytest.raises(DiagramValidationError) as exc_info:
            convert_diagram_to_relational(bad_doc)
        assert len(exc_info.value.errors) > 0


# ══════════════════════════════════════════════════════════════════════════════
#  4. Serialization Round-Trip Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestSchemaSerialization:
    def test_round_trip(self):
        doc = make_canonical_student_course_diagram()
        schema = convert_diagram_to_relational(doc)
        d = schema_to_dict(schema)
        reconstructed = schema_from_dict(d)

        assert reconstructed.table_names() == schema.table_names()
        for t in schema.tables:
            rec_t = reconstructed.get_table(t.name)
            assert rec_t is not None
            assert rec_t.primary_key == t.primary_key
            assert rec_t.column_names() == t.column_names()
            assert len(rec_t.foreign_keys) == len(t.foreign_keys)
            for fk_orig, fk_rec in zip(t.foreign_keys, rec_t.foreign_keys):
                assert fk_orig.columns == fk_rec.columns
                assert fk_orig.ref_table == fk_rec.ref_table
                assert fk_orig.ref_columns == fk_rec.ref_columns
