"""
tester — Automated SQL Test Generator & Runner for Query-Based Validation.

Responsibilities:
  1. Dynamically maps QuestionSpec entities and attributes to the student's RelationalSchema
     without hardcoding table or column names (supports case, plurals, and junction FK heuristics).
  2. Executes behavioral SQL tests against an isolated SandboxDatabase.
  3. Ensures absolute test isolation by running each test in a pristine sandbox environment.
  4. Distinguishes between operations that should succeed vs constraints that must reject invalid data
     (e.g. duplicate insertions, invalid foreign key references).
  5. Returns structured TestOutcome and TestSuiteResult objects with mark allocations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from app.query_validator.converter import Column, RelationalSchema, Table
from app.query_validator.ddl import generate_schema_ddl, quote_identifier
from app.query_validator.sandbox import SandboxDatabase, SandboxExecutionError
from app.query_validator.spec import QuestionSpec, SqlTestSpec


# ══════════════════════════════════════════════════════════════════════════════
#  Data Models for Test Results
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class TestOutcome:
    """The outcome of running a single behavioral SQL test."""
    __test__ = False

    test_name: str
    description: str
    kind: str
    passed: bool
    marks_earned: float
    marks_possible: float
    message: str
    executed_sql: List[str] = field(default_factory=list)
    error_details: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "description": self.description,
            "kind": self.kind,
            "passed": self.passed,
            "marks_earned": self.marks_earned,
            "marks_possible": self.marks_possible,
            "message": self.message,
            "executed_sql": self.executed_sql,
            "error_details": self.error_details,
        }


@dataclass
class TestSuiteResult:
    """Summary of all executed behavioral tests."""
    __test__ = False

    total_marks_earned: float
    total_marks_possible: float
    passed_tests: List[TestOutcome] = field(default_factory=list)
    failed_tests: List[TestOutcome] = field(default_factory=list)
    all_tests: List[TestOutcome] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_marks_earned": round(self.total_marks_earned, 2),
            "total_marks_possible": round(self.total_marks_possible, 2),
            "percentage": round(
                (self.total_marks_earned / self.total_marks_possible * 100)
                if self.total_marks_possible > 0
                else 0.0,
                2,
            ),
            "passed_tests": [t.to_dict() for t in self.passed_tests],
            "failed_tests": [t.to_dict() for t in self.failed_tests],
            "all_tests": [t.to_dict() for t in self.all_tests],
        }


# ══════════════════════════════════════════════════════════════════════════════
#  Entity & Column Resolver
# ══════════════════════════════════════════════════════════════════════════════

class EntityResolver:
    """
    Dynamically maps spec entities and attributes to the student's actual schema.
    Resolves variations in casing, singular/plural, and identifies junction tables
    by their foreign key relationships.
    """

    def __init__(self, schema: RelationalSchema):
        self.schema = schema
        self._table_map: Dict[str, Table] = {t.name.lower(): t for t in schema.tables}

    def resolve_table(self, entity_name: str) -> Optional[Table]:
        """
        Finds the student's table corresponding to entity_name.
        Tries:
          1. Exact match (case-insensitive)
          2. Plural / singular variations (e.g. Student <-> Students)
          3. Junction table heuristics (e.g. Student_Course or table with FKs to both)
        """
        lower = entity_name.lower().strip()

        # 1. Exact match
        if lower in self._table_map:
            return self._table_map[lower]

        # 2. Singular / Plural variations
        if lower.endswith("s") and lower[:-1] in self._table_map:
            return self._table_map[lower[:-1]]
        if (lower + "s") in self._table_map:
            return self._table_map[lower + "s"]

        # 3. Junction table heuristics (e.g. "Student_Course")
        if "_" in lower:
            parts = lower.split("_")
            if len(parts) == 2:
                p1, p2 = parts[0], parts[1]
                # Try reversed: Course_Student
                rev = f"{p2}_{p1}"
                if rev in self._table_map:
                    return self._table_map[rev]

                # Try finding a table that has FKs to both p1 and p2
                t1 = self.resolve_table(p1)
                t2 = self.resolve_table(p2)
                if t1 and t2:
                    for cand in self.schema.tables:
                        fk_targets = {fk.ref_table.lower() for fk in cand.foreign_keys}
                        if t1.name.lower() in fk_targets and t2.name.lower() in fk_targets:
                            return cand

        return None

    def resolve_column(self, table: Table, attr_name: str) -> Optional[Column]:
        """
        Finds the column in table corresponding to attr_name.
        Tries:
          1. Exact column name (case-insensitive)
          2. Common PK aliases: if attr is "student_id", matches "id" if table is Student
          3. If attr is "id", matches "{table_name}_id"
        """
        lower = attr_name.lower().strip()
        col_map = {c.name.lower(): c for c in table.columns}

        # 1. Exact match
        if lower in col_map:
            return col_map[lower]

        # 2. If table primary key is named "id" and attr is "{table}_id"
        t_name = table.name.lower()
        if lower == f"{t_name}_id" and "id" in col_map:
            return col_map["id"]

        # 3. If attr is "id" and column is "{table}_id"
        if lower == "id" and f"{t_name}_id" in col_map:
            return col_map[f"{t_name}_id"]

        # 4. If table has foreign keys, check if column points to referenced table
        for fk in table.foreign_keys:
            if fk.ref_table.lower() in lower or lower.startswith(fk.ref_table.lower()):
                if fk.columns and fk.columns[0].lower() in col_map:
                    return col_map[fk.columns[0].lower()]

        return None


# ══════════════════════════════════════════════════════════════════════════════
#  Test Generator & Runner
# ══════════════════════════════════════════════════════════════════════════════

def build_insert_sql(table: Table, row_data: Dict[str, Any], resolver: EntityResolver) -> Tuple[str, Tuple[Any, ...]]:
    """
    Builds a parameterized INSERT SQL statement and values tuple.
    Maps attribute names to actual student column names.
    """
    col_names: List[str] = []
    params: List[Any] = []

    for attr, val in row_data.items():
        col = resolver.resolve_column(table, attr)
        actual_name = col.name if col else attr
        col_names.append(quote_identifier(actual_name))
        params.append(val)

    q_table = quote_identifier(table.name)
    q_cols = ", ".join(col_names)
    placeholders = ", ".join(["?"] * len(params))

    sql = f"INSERT INTO {q_table} ({q_cols}) VALUES ({placeholders});"
    return sql, tuple(params)


def run_single_sql_test(
    test_spec: SqlTestSpec,
    schema: RelationalSchema,
    schema_ddl: str,
    resolver: EntityResolver,
) -> TestOutcome:
    """
    Executes a single SqlTestSpec in a fresh, isolated SandboxDatabase.
    """
    executed_sqls: List[str] = []

    # 1. Ensure required entities exist in student schema
    target_entity = test_spec.operation.get("entity", "")
    target_table = resolver.resolve_table(target_entity) if target_entity else None

    if target_entity and target_table is None and not test_spec.operation.get("sql"):
        return TestOutcome(
            test_name=test_spec.name,
            description=test_spec.description,
            kind=test_spec.kind,
            passed=False,
            marks_earned=0.0,
            marks_possible=test_spec.marks,
            message=f"Entity '{target_entity}' could not be resolved in student's schema.",
            executed_sql=[],
            error_details=f"Missing table for entity '{target_entity}'.",
        )

    # 2. Run test inside a fresh isolated sandbox
    with SandboxDatabase(foreign_keys=True) as db:
        try:
            # Initialize schema
            db.execute_ddl(schema_ddl)
        except SandboxExecutionError as e:
            return TestOutcome(
                test_name=test_spec.name,
                description=test_spec.description,
                kind=test_spec.kind,
                passed=False,
                marks_earned=0.0,
                marks_possible=test_spec.marks,
                message="Cannot run behavioral test because schema DDL failed to execute.",
                executed_sql=[],
                error_details=str(e),
            )

        # 3. Execute setup fixtures
        if test_spec.setup:
            for setup_entity, rows in test_spec.setup.items():
                s_table = resolver.resolve_table(setup_entity)
                if s_table is None:
                    return TestOutcome(
                        test_name=test_spec.name,
                        description=test_spec.description,
                        kind=test_spec.kind,
                        passed=False,
                        marks_earned=0.0,
                        marks_possible=test_spec.marks,
                        message=f"Setup failed: entity '{setup_entity}' not found in student's schema.",
                        executed_sql=executed_sqls,
                    )

                for row in rows:
                    sql, params = build_insert_sql(s_table, row, resolver)
                    executed_sqls.append(f"{sql} -- params: {params}")
                    try:
                        db.execute_statement(sql, params)
                    except SandboxExecutionError as e:
                        return TestOutcome(
                            test_name=test_spec.name,
                            description=test_spec.description,
                            kind=test_spec.kind,
                            passed=False,
                            marks_earned=0.0,
                            marks_possible=test_spec.marks,
                            message=f"Setup failed while inserting prerequisite data into '{s_table.name}': {e}",
                            executed_sql=executed_sqls,
                            error_details=str(e),
                        )

        # 4. Execute operation(s)
        operations: List[Dict[str, Any]] = []
        if "sql" in test_spec.operation and test_spec.operation["sql"]:
            operations = [{"sql": test_spec.operation["sql"]}]
        elif "operations" in test_spec.operation:
            operations = test_spec.operation["operations"]
        elif "row" in test_spec.operation and target_table:
            operations = [{"table": target_table, "row": test_spec.operation["row"]}]

        operation_error: Optional[Exception] = None

        for op in operations:
            if "sql" in op and op["sql"]:
                raw_sql = str(op["sql"]).strip()
                executed_sqls.append(raw_sql)
                try:
                    db.execute_statement(raw_sql)
                except SandboxExecutionError as e:
                    operation_error = e
                    break
                continue

            op_table = op.get("table")
            if not op_table:
                op_entity = op.get("entity", target_entity)
                op_table = resolver.resolve_table(op_entity)
            if not op_table:
                return TestOutcome(
                    test_name=test_spec.name,
                    description=test_spec.description,
                    kind=test_spec.kind,
                    passed=False,
                    marks_earned=0.0,
                    marks_possible=test_spec.marks,
                    message="Target table for test operation could not be resolved.",
                    executed_sql=executed_sqls,
                )

            sql, params = build_insert_sql(op_table, op["row"], resolver)
            executed_sqls.append(f"{sql} -- params: {params}")

            try:
                db.execute_statement(sql, params)
            except SandboxExecutionError as e:
                operation_error = e
                break

        # 5. Evaluate Expected Outcome vs Actual Outcome
        if test_spec.expect_success:
            if operation_error is None:
                return TestOutcome(
                    test_name=test_spec.name,
                    description=test_spec.description,
                    kind=test_spec.kind,
                    passed=True,
                    marks_earned=test_spec.marks,
                    marks_possible=test_spec.marks,
                    message="Test passed: operation completed successfully as expected.",
                    executed_sql=executed_sqls,
                )
            else:
                return TestOutcome(
                    test_name=test_spec.name,
                    description=test_spec.description,
                    kind=test_spec.kind,
                    passed=False,
                    marks_earned=0.0,
                    marks_possible=test_spec.marks,
                    message=f"Operation failed unexpectedly: {operation_error}",
                    executed_sql=executed_sqls,
                    error_details=str(operation_error),
                )
        else:
            # Negative test: operation was EXPECTED to fail (e.g. duplicate or FK violation)
            if operation_error is not None:
                return TestOutcome(
                    test_name=test_spec.name,
                    description=test_spec.description,
                    kind=test_spec.kind,
                    passed=True,
                    marks_earned=test_spec.marks,
                    marks_possible=test_spec.marks,
                    message=f"Constraint correctly enforced: rejected invalid operation ({operation_error}).",
                    executed_sql=executed_sqls,
                    error_details=str(operation_error),
                )
            else:
                return TestOutcome(
                    test_name=test_spec.name,
                    description=test_spec.description,
                    kind=test_spec.kind,
                    passed=False,
                    marks_earned=0.0,
                    marks_possible=test_spec.marks,
                    message=(
                        "Expected operation to be rejected by schema constraints, but the insertion succeeded. "
                        "The schema is missing a required UNIQUE, PRIMARY KEY, or FOREIGN KEY constraint."
                    ),
                    executed_sql=executed_sqls,
                )


def run_behavioral_tests(
    question_spec: QuestionSpec,
    schema: RelationalSchema,
) -> TestSuiteResult:
    """
    Runs all behavioral SQL tests defined in a QuestionSpec against the student's schema.
    """
    resolver = EntityResolver(schema)
    schema_ddl = generate_schema_ddl(schema)

    all_outcomes: List[TestOutcome] = []
    passed_outcomes: List[TestOutcome] = []
    failed_outcomes: List[TestOutcome] = []

    total_earned = 0.0
    total_possible = 0.0

    for test_spec in question_spec.sql_tests:
        outcome = run_single_sql_test(test_spec, schema, schema_ddl, resolver)
        all_outcomes.append(outcome)
        total_possible += outcome.marks_possible

        if outcome.passed:
            passed_outcomes.append(outcome)
            total_earned += outcome.marks_earned
        else:
            failed_outcomes.append(outcome)

    return TestSuiteResult(
        total_marks_earned=total_earned,
        total_marks_possible=total_possible,
        passed_tests=passed_outcomes,
        failed_tests=failed_outcomes,
        all_tests=all_outcomes,
    )
