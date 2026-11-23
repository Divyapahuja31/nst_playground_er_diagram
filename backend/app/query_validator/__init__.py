"""
query_validator — query-based validation engine (V1).

Modules
-------
  spec       QuestionSpec dataclass + loader/saver/validator
  converter  diagram_json → RelationalSchema          (Phase 2)
  ddl        RelationalSchema → SQL DDL strings       (Phase 3)
  runner     scratch-schema test executor             (Phase 4)
  scorer     combined structural + SQL scoring        (Phase 5)
"""

from app.query_validator.spec import (
    AttributeSpec,
    EntitySpec,
    MarkScheme,
    QuestionSpec,
    RelationshipSpec,
    SqlTestSpec,
    load_spec,
    make_student_course_spec,
    save_spec,
    spec_from_dict,
    spec_to_dict,
    validate_spec,
)

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

from app.query_validator.tester import (
    EntityResolver,
    TestOutcome,
    TestSuiteResult,
    run_behavioral_tests,
    run_single_sql_test,
)

from app.query_validator.scorer import (
    CriterionScore,
    ValidationReport,
    evaluate_behavioral_tests_criterion,
    evaluate_entities_and_attributes,
    evaluate_keys_and_constraints,
    evaluate_relationships_and_cardinalities,
    evaluate_submission,
)

__all__ = [
    # Phase 1
    "AttributeSpec",
    "EntitySpec",
    "MarkScheme",
    "QuestionSpec",
    "RelationshipSpec",
    "SqlTestSpec",
    "load_spec",
    "save_spec",
    "spec_from_dict",
    "spec_to_dict",
    "validate_spec",
    "make_student_course_spec",
    # Phase 2
    "Column",
    "ForeignKey",
    "Table",
    "RelationalSchema",
    "DiagramValidationError",
    "validate_diagram_structure",
    "convert_diagram_to_relational",
    "schema_to_dict",
    "schema_from_dict",
    "is_valid_identifier",
    "sanitize_identifier",
    "normalize_data_type",
    "build_check_expression",
    # Phase 3
    "quote_identifier",
    "format_default_value",
    "sort_tables_topologically",
    "generate_column_def",
    "generate_create_table_sql",
    "generate_schema_ddl",
    "SandboxDatabase",
    "SandboxExecutionError",
    # Phase 4
    "EntityResolver",
    "TestOutcome",
    "TestSuiteResult",
    "run_behavioral_tests",
    "run_single_sql_test",
    # Phase 5
    "CriterionScore",
    "ValidationReport",
    "evaluate_submission",
    "evaluate_entities_and_attributes",
    "evaluate_relationships_and_cardinalities",
    "evaluate_keys_and_constraints",
    "evaluate_behavioral_tests_criterion",
]