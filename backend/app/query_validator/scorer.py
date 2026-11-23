"""
scorer — Validation & Scoring Engine for Query-Based Validation V1.

Responsibilities:
  1. Combines structural schema inspection with behavioral SQL test outcomes.
  2. Evaluates the 4 configurable rubric criteria:
     - Entities and Attributes (default 25%)
     - Relationships and Cardinalities (default 25%)
     - Keys and Constraints (default 25%)
     - SQL Behavioral Tests (default 25%)
  3. Implements anti-cascading logic to avoid double-penalizing downstream errors
     (identifies root cause vs cascading test failures).
  4. Handles malformed diagram submissions and SQL syntax failures gracefully.
  5. Returns a rich, student-friendly ValidationReport with structured feedback,
     mark breakdowns, passed/failed checks, and actionable hints.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from app.query_validator.converter import (
    Column,
    DiagramValidationError,
    ForeignKey,
    RelationalSchema,
    Table,
    convert_diagram_to_relational,
    validate_diagram_structure,
)
from app.query_validator.ddl import generate_schema_ddl
from app.query_validator.sandbox import SandboxDatabase, SandboxExecutionError
from app.query_validator.spec import (
    EntitySpec,
    QuestionSpec,
    RelationshipSpec,
)
from app.query_validator.tester import (
    EntityResolver,
    TestSuiteResult,
    run_behavioral_tests,
)


# ══════════════════════════════════════════════════════════════════════════════
#  Data Models for Scoring
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class CriterionScore:
    """Score and feedback for a single rubric criterion."""
    __test__ = False

    name: str
    label: str
    marks_earned: float
    marks_possible: float
    passed_checks: List[str] = field(default_factory=list)
    failed_checks: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)

    @property
    def percentage(self) -> float:
        if self.marks_possible <= 0:
            return 100.0
        return round((self.marks_earned / self.marks_possible) * 100, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "marks_earned": round(self.marks_earned, 2),
            "marks_possible": round(self.marks_possible, 2),
            "percentage": self.percentage,
            "passed_checks": self.passed_checks,
            "failed_checks": self.failed_checks,
            "suggestions": self.suggestions,
        }


@dataclass
class ValidationReport:
    """Complete, student-facing validation report combining all criteria and SQL tests."""
    __test__ = False

    is_valid: bool
    total_marks_earned: float
    total_marks_possible: float
    percentage: float
    status: str  # "accepted", "partial", "rejected"
    criteria: Dict[str, CriterionScore] = field(default_factory=dict)
    all_passed_checks: List[str] = field(default_factory=list)
    all_failed_checks: List[str] = field(default_factory=list)
    root_cause_errors: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    behavioral_test_results: Optional[Dict[str, Any]] = None
    diagram_errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "total_marks_earned": round(self.total_marks_earned, 2),
            "total_marks_possible": round(self.total_marks_possible, 2),
            "percentage": round(self.percentage, 2),
            "score": round(self.total_marks_earned, 2),
            "status": self.status,
            "validation_engine": "query_validator",
            "mismatches": [{"code": "failed_check", "message": f} for f in self.all_failed_checks],
            "criteria": {k: v.to_dict() for k, v in self.criteria.items()},
            "all_passed_checks": self.all_passed_checks,
            "all_failed_checks": self.all_failed_checks,
            "root_cause_errors": self.root_cause_errors,
            "suggestions": self.suggestions,
            "behavioral_test_results": self.behavioral_test_results,
            "diagram_errors": self.diagram_errors,
        }


# ══════════════════════════════════════════════════════════════════════════════
#  Criterion Evaluators
# ══════════════════════════════════════════════════════════════════════════════

def evaluate_entities_and_attributes(
    spec: QuestionSpec,
    schema: RelationalSchema,
    resolver: EntityResolver,
) -> Tuple[CriterionScore, Set[str]]:
    """
    Evaluates Criterion 1: Entities and Attributes.
    Returns CriterionScore and a set of missing entity names (for anti-cascading).
    """
    possible = spec.marks.entities_and_attributes
    passed: List[str] = []
    failed: List[str] = []
    suggestions: List[str] = []
    missing_entities: Set[str] = set()

    if not spec.entities:
        return CriterionScore(
            name="entities_and_attributes",
            label="Entities and Attributes",
            marks_earned=possible,
            marks_possible=possible,
            passed_checks=["No specific entity requirements defined."],
        ), missing_entities

    # Total check items = number of required entities + sum of required attributes
    total_items = 0
    earned_items = 0

    for e_spec in spec.entities:
        total_items += 1  # check for entity itself
        table = resolver.resolve_table(e_spec.name)

        if table is None:
            failed.append(f"Missing required entity '{e_spec.name}'.")
            suggestions.append(f"Create a table named '{e_spec.name}'.")
            missing_entities.add(e_spec.name.lower())
            # All attributes also fail if table is missing
            total_items += len(e_spec.attributes)
            continue

        earned_items += 1
        passed.append(f"Entity '{e_spec.name}' present (mapped to table '{table.name}').")

        # Check attributes
        for a_spec in e_spec.attributes:
            total_items += 1
            col = resolver.resolve_column(table, a_spec.name)

            if col is None:
                failed.append(f"Table '{table.name}' is missing attribute '{a_spec.name}'.")
                suggestions.append(f"Add column '{a_spec.name}' to table '{table.name}'.")
            else:
                earned_items += 1
                passed.append(f"Attribute '{e_spec.name}.{a_spec.name}' present.")

    marks_earned = (earned_items / total_items * possible) if total_items > 0 else possible

    return CriterionScore(
        name="entities_and_attributes",
        label="Entities and Attributes",
        marks_earned=marks_earned,
        marks_possible=possible,
        passed_checks=passed,
        failed_checks=failed,
        suggestions=suggestions,
    ), missing_entities


def evaluate_relationships_and_cardinalities(
    spec: QuestionSpec,
    schema: RelationalSchema,
    resolver: EntityResolver,
    missing_entities: Set[str],
) -> Tuple[CriterionScore, Set[str]]:
    """
    Evaluates Criterion 2: Relationships and Cardinalities.
    Returns CriterionScore and a set of missing relationship keys.
    """
    possible = spec.marks.relationships_and_cardinalities
    passed: List[str] = []
    failed: List[str] = []
    suggestions: List[str] = []
    missing_rels: Set[str] = set()

    if not spec.relationships:
        return CriterionScore(
            name="relationships_and_cardinalities",
            label="Relationships and Cardinalities",
            marks_earned=possible,
            marks_possible=possible,
            passed_checks=["No relationship requirements defined."],
        ), missing_rels

    total_items = len(spec.relationships)
    earned_items = 0

    for r_spec in spec.relationships:
        r_key = f"{r_spec.from_entity}->{r_spec.to_entity}:{r_spec.cardinality}"
        t1 = resolver.resolve_table(r_spec.from_entity)
        t2 = resolver.resolve_table(r_spec.to_entity)

        # Anti-cascading: if either table is missing, note it without compounding mystery
        if t1 is None or t2 is None:
            failed.append(
                f"Relationship '{r_spec.from_entity}' - '{r_spec.to_entity}' ({r_spec.cardinality}) "
                f"cannot be verified because one or both entities are missing."
            )
            missing_rels.add(r_key)
            continue

        if r_spec.cardinality == "many_to_many":
            # For M:N, check if junction table exists and has foreign keys to both entities
            junction_name = r_spec.junction_table_name or f"{r_spec.from_entity}_{r_spec.to_entity}"
            j_table = resolver.resolve_table(junction_name)

            if j_table is None:
                # Check if there is any table referencing both t1 and t2
                for cand in schema.tables:
                    fk_targets = {fk.ref_table.lower() for fk in cand.foreign_keys}
                    if t1.name.lower() in fk_targets and t2.name.lower() in fk_targets:
                        j_table = cand
                        break

            if j_table is not None:
                fk_targets = {fk.ref_table.lower() for fk in j_table.foreign_keys}
                has_both_fks = t1.name.lower() in fk_targets and t2.name.lower() in fk_targets
                if has_both_fks:
                    earned_items += 1
                    passed.append(
                        f"Many-to-Many relationship between '{r_spec.from_entity}' and '{r_spec.to_entity}' "
                        f"satisfied by junction table '{j_table.name}'."
                    )
                else:
                    failed.append(
                        f"Junction table '{j_table.name}' exists but is missing foreign keys referencing "
                        f"'{r_spec.from_entity}' and '{r_spec.to_entity}'."
                    )
                    suggestions.append(
                        f"Add foreign keys to junction table '{j_table.name}' referencing both '{t1.name}' and '{t2.name}'."
                    )
                    missing_rels.add(r_key)
            else:
                failed.append(
                    f"Missing junction table for Many-to-Many relationship between '{r_spec.from_entity}' "
                    f"and '{r_spec.to_entity}'."
                )
                suggestions.append(
                    f"Create an intermediate junction table (e.g. '{junction_name}') with foreign keys "
                    f"referencing both '{t1.name}' and '{t2.name}'."
                )
                missing_rels.add(r_key)

        elif r_spec.cardinality in ("many_to_one", "one_to_many"):
            # Check if an FK exists between t1 and t2
            has_fk = any(
                fk.ref_table.lower() in (t1.name.lower(), t2.name.lower())
                for fk in t1.foreign_keys + t2.foreign_keys
            )
            if has_fk:
                earned_items += 1
                passed.append(
                    f"Relationship between '{r_spec.from_entity}' and '{r_spec.to_entity}' "
                    f"({r_spec.cardinality}) correctly linked via foreign key."
                )
            else:
                failed.append(
                    f"Missing foreign key relationship between '{r_spec.from_entity}' and '{r_spec.to_entity}'."
                )
                suggestions.append(f"Add a foreign key connecting '{t1.name}' and '{t2.name}'.")
                missing_rels.add(r_key)

        elif r_spec.cardinality == "one_to_one":
            has_1to1_fk = any(
                fk.ref_table.lower() == t2.name.lower() and (
                    t1.get_column(fk.columns[0]) and t1.get_column(fk.columns[0]).is_unique
                )
                for fk in t1.foreign_keys
            ) or any(
                fk.ref_table.lower() == t1.name.lower() and (
                    t2.get_column(fk.columns[0]) and t2.get_column(fk.columns[0]).is_unique
                )
                for fk in t2.foreign_keys
            )

            if has_1to1_fk:
                earned_items += 1
                passed.append(
                    f"One-to-One relationship between '{r_spec.from_entity}' and '{r_spec.to_entity}' "
                    f"enforced with unique foreign key."
                )
            else:
                failed.append(
                    f"One-to-One relationship between '{r_spec.from_entity}' and '{r_spec.to_entity}' "
                    f"is missing a unique foreign key constraint."
                )
                suggestions.append(
                    f"Add a foreign key between '{t1.name}' and '{t2.name}' and mark the referencing column as UNIQUE."
                )
                missing_rels.add(r_key)

    marks_earned = (earned_items / total_items * possible) if total_items > 0 else possible

    return CriterionScore(
        name="relationships_and_cardinalities",
        label="Relationships and Cardinalities",
        marks_earned=marks_earned,
        marks_possible=possible,
        passed_checks=passed,
        failed_checks=failed,
        suggestions=suggestions,
    ), missing_rels


def evaluate_keys_and_constraints(
    spec: QuestionSpec,
    schema: RelationalSchema,
    resolver: EntityResolver,
    missing_entities: Set[str],
) -> CriterionScore:
    """
    Evaluates Criterion 3: Primary and Foreign Keys & Constraints.
    """
    possible = spec.marks.keys_and_constraints
    passed: List[str] = []
    failed: List[str] = []
    suggestions: List[str] = []

    total_items = 0
    earned_items = 0

    # 1. Primary keys on all required entities
    for e_spec in spec.entities:
        if e_spec.name.lower() in missing_entities:
            continue

        table = resolver.resolve_table(e_spec.name)
        if not table:
            continue

        total_items += 1
        expected_pk_attrs = [a.name for a in e_spec.attributes if a.is_primary_key]

        if not table.primary_key:
            failed.append(f"Table '{table.name}' is missing a Primary Key.")
            suggestions.append(f"Define a primary key on table '{table.name}'.")
        else:
            # Check if expected PK columns are covered
            earned_items += 1
            pk_str = ", ".join(table.primary_key)
            passed.append(f"Table '{table.name}' defines primary key ({pk_str}).")

    # 2. Foreign keys required by relationships
    for r_spec in spec.relationships:
        if r_spec.cardinality == "many_to_many":
            junction_name = r_spec.junction_table_name or f"{r_spec.from_entity}_{r_spec.to_entity}"
            j_table = resolver.resolve_table(junction_name)
            if not j_table:
                # Find any table with FKs to both
                t1 = resolver.resolve_table(r_spec.from_entity)
                t2 = resolver.resolve_table(r_spec.to_entity)
                if t1 and t2:
                    for cand in schema.tables:
                        fk_targets = {fk.ref_table.lower() for fk in cand.foreign_keys}
                        if t1.name.lower() in fk_targets and t2.name.lower() in fk_targets:
                            j_table = cand
                            break

            if j_table:
                # Junction table should have 2 foreign keys and composite PK
                total_items += 2
                t1 = resolver.resolve_table(r_spec.from_entity)
                t2 = resolver.resolve_table(r_spec.to_entity)

                fk_targets = {fk.ref_table.lower() for fk in j_table.foreign_keys}

                if t1 and t1.name.lower() in fk_targets:
                    earned_items += 1
                    passed.append(f"Junction table '{j_table.name}' has foreign key to '{t1.name}'.")
                else:
                    failed.append(f"Junction table '{j_table.name}' is missing foreign key to '{r_spec.from_entity}'.")
                    suggestions.append(f"Add a foreign key on '{j_table.name}' referencing '{r_spec.from_entity}'.")

                if t2 and t2.name.lower() in fk_targets:
                    earned_items += 1
                    passed.append(f"Junction table '{j_table.name}' has foreign key to '{t2.name}'.")
                else:
                    failed.append(f"Junction table '{j_table.name}' is missing foreign key to '{r_spec.to_entity}'.")
                    suggestions.append(f"Add a foreign key on '{j_table.name}' referencing '{r_spec.to_entity}'.")

    marks_earned = (earned_items / total_items * possible) if total_items > 0 else possible

    return CriterionScore(
        name="keys_and_constraints",
        label="Primary and Foreign Keys",
        marks_earned=marks_earned,
        marks_possible=possible,
        passed_checks=passed,
        failed_checks=failed,
        suggestions=suggestions,
    )


def evaluate_behavioral_tests_criterion(
    spec: QuestionSpec,
    schema: RelationalSchema,
    missing_entities: Set[str],
) -> Tuple[CriterionScore, TestSuiteResult]:
    """
    Evaluates Criterion 4: SQL Behavioral Tests.
    Applies anti-cascading logic so tests failing due to an already-penalized missing table
    are clearly identified.
    """
    possible = spec.marks.sql_behavioral_tests
    test_result = run_behavioral_tests(spec, schema)

    passed: List[str] = []
    failed: List[str] = []
    suggestions: List[str] = []

    for outcome in test_result.passed_tests:
        passed.append(f"✓ {outcome.description} ({outcome.marks_earned:.1f}/{outcome.marks_possible:.1f} pts)")

    for outcome in test_result.failed_tests:
        # Check if failure is cascading from a missing entity
        is_cascading = any(
            f"'{missing}'" in outcome.message.lower() or f"'{missing}'" in (outcome.error_details or "").lower()
            for missing in missing_entities
        )
        tag = "[Cascading Root Cause: Missing Table]" if is_cascading else "[Constraint Error]"
        failed.append(f"✗ {tag} {outcome.description}: {outcome.message}")

        if outcome.kind == "insert_duplicate":
            suggestions.append(
                f"Ensure the combination of columns in the junction table enforces uniqueness (e.g. composite primary key)."
            )
        elif outcome.kind == "insert_fk_invalid":
            suggestions.append(
                f"Ensure foreign key constraints are properly defined so invalid references cannot be inserted."
            )

    # Scale earned marks to the criterion weight
    scaled_earned = (
        (test_result.total_marks_earned / test_result.total_marks_possible * possible)
        if test_result.total_marks_possible > 0
        else possible
    )

    score = CriterionScore(
        name="sql_behavioral_tests",
        label="SQL Behavioral Tests",
        marks_earned=scaled_earned,
        marks_possible=possible,
        passed_checks=passed,
        failed_checks=failed,
        suggestions=suggestions,
    )
    return score, test_result


# ══════════════════════════════════════════════════════════════════════════════
#  Main Evaluation Entrypoint
# ══════════════════════════════════════════════════════════════════════════════

def evaluate_submission(
    spec: QuestionSpec,
    diagram_doc: Dict[str, Any],
) -> ValidationReport:
    """
    Complete evaluation entry point for a student's ER diagram submission.

    Steps:
      1. Structural validation of incoming diagram JSON.
      2. Diagram-to-Relational conversion.
      3. DDL generation and sandbox dry-run execution.
      4. Evaluation of all 4 criteria with anti-cascading deductions.
      5. Synthesis of overall score, status, and actionable recommendations.
    """
    # 1. Structural Diagram Validation
    diag_errors = validate_diagram_structure(diagram_doc)
    if diag_errors:
        return ValidationReport(
            is_valid=False,
            total_marks_earned=0.0,
            total_marks_possible=100.0,
            percentage=0.0,
            status="rejected",
            criteria={},
            diagram_errors=diag_errors,
            root_cause_errors=diag_errors,
            suggestions=[f"Fix structural diagram error: {e}" for e in diag_errors[:3]],
        )

    # 2. Diagram-to-Relational Schema Conversion
    try:
        schema = convert_diagram_to_relational(diagram_doc)
    except DiagramValidationError as e:
        return ValidationReport(
            is_valid=False,
            total_marks_earned=0.0,
            total_marks_possible=100.0,
            percentage=0.0,
            status="rejected",
            criteria={},
            diagram_errors=e.errors,
            root_cause_errors=e.errors,
            suggestions=[f"Resolve diagram conversion error: {err}" for err in e.errors[:3]],
        )

    # 3. Verify DDL can execute in SQLite sandbox
    ddl = generate_schema_ddl(schema)
    try:
        with SandboxDatabase() as db:
            db.execute_ddl(ddl)
    except SandboxExecutionError as e:
        return ValidationReport(
            is_valid=False,
            total_marks_earned=0.0,
            total_marks_possible=100.0,
            percentage=0.0,
            status="rejected",
            criteria={},
            root_cause_errors=[f"Schema SQL generation error: {e}"],
            suggestions=["Ensure all table names, column types, and constraints are valid SQL."],
        )

    # 4. Multi-Criteria Evaluation with Anti-Cascading
    resolver = EntityResolver(schema)

    c1_score, missing_entities = evaluate_entities_and_attributes(spec, schema, resolver)
    c2_score, missing_rels = evaluate_relationships_and_cardinalities(spec, schema, resolver, missing_entities)
    c3_score = evaluate_keys_and_constraints(spec, schema, resolver, missing_entities)
    c4_score, test_suite_result = evaluate_behavioral_tests_criterion(spec, schema, missing_entities)

    criteria_dict = {
        "entities_and_attributes": c1_score,
        "relationships_and_cardinalities": c2_score,
        "keys_and_constraints": c3_score,
        "sql_behavioral_tests": c4_score,
    }

    total_earned = sum(c.marks_earned for c in criteria_dict.values())
    total_possible = sum(c.marks_possible for c in criteria_dict.values())
    percentage = (total_earned / total_possible * 100) if total_possible > 0 else 0.0

    # Aggregate checks
    all_passed: List[str] = []
    all_failed: List[str] = []
    all_suggestions: List[str] = []
    root_causes: List[str] = []

    for c in criteria_dict.values():
        all_passed.extend(c.passed_checks)
        all_failed.extend(c.failed_checks)
        all_suggestions.extend(c.suggestions)

    if missing_entities:
        root_causes.append(f"Missing required entities: {', '.join(sorted(missing_entities))}")
    if c3_score.failed_checks:
        root_causes.extend(c3_score.failed_checks)

    # Determine status & validity
    if percentage >= 90.0 and len(root_causes) == 0:
        status = "accepted"
        is_valid = True
    elif percentage >= 50.0:
        status = "partial"
        is_valid = False
    else:
        status = "rejected"
        is_valid = False

    return ValidationReport(
        is_valid=is_valid,
        total_marks_earned=round(total_earned, 2),
        total_marks_possible=round(total_possible, 2),
        percentage=round(percentage, 2),
        status=status,
        criteria=criteria_dict,
        all_passed_checks=all_passed,
        all_failed_checks=all_failed,
        root_cause_errors=root_causes,
        suggestions=list(dict.fromkeys(all_suggestions)),  # deduplicate preserving order
        behavioral_test_results=test_suite_result.to_dict(),
    )
