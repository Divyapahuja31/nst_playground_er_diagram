# This file will be used before running bliss as bliss can take time, so we remove the obvious wrong answer
# by comparing count of tables, relation, fields, etc. So that bliss does not take that much time 

from .graphBuilder import field_color_key, ColorTable
from .schema import validate_check_constraint
from collections import Counter

def _mismatch(code, message, solution=None, student=None):
    return {'code': code, 'message': message, 'solution': solution, 'student': student}

def _counter_differences(code, what, solution_counts, student_counts, describe=str):
    differences = []
    for key in sorted(set(solution_counts) | set(student_counts), key=str):
        solution_count, student_count = solution_counts.get(key, 0), student_counts.get(key, 0)
        if solution_count != student_count:
            differences.append(_mismatch(
                code,
                f'solution has {solution_count} {what} {describe(key)}; student has {student_count}',
                solution=solution_count, student=student_count,
            ))
    return differences

def _table_signature(t):
    return tuple(sorted(field_color_key(f) for f in t.fields))

def _describe_signature(signature):
    return '{' + ', '.join(ColorTable.describe(key) for key in signature) + '}'

def _rel_endpoint_key(diagram, relationship):
    fields = {field.id: field for table in diagram.tables for field in table.fields}
    source = field_color_key(fields[relationship.start_field])
    destination = field_color_key(fields[relationship.end_field])
    if relationship.cardinality == 'one_to_one' and destination < source:
        source, destination = destination, source
    return (source, destination, relationship.cardinality)

def _describe_endpoint(key):
    source, destination, card = key
    return f'{ColorTable.describe(source)} -> {ColorTable.describe(destination)} ({card})'

def _compare_default_values(solution, student):
    """Check that default values match between matched fields (by type+flag signature)."""
    mismatches = []

    def field_defaults(diagram):
        # Group default values by field type signature (ignoring default/check in key)
        result = Counter()
        for t in diagram.tables:
            for f in t.fields:
                base_key = field_color_key(f)[:6]  # type + flags only
                val = f.default.strip() if f.default else ''
                result[(base_key, val)] += 1
        return result

    sol_defaults = field_defaults(solution)
    stu_defaults = field_defaults(student)

    for key in sorted(set(sol_defaults) | set(stu_defaults), key=str):
        sol_count = sol_defaults.get(key, 0)
        stu_count = stu_defaults.get(key, 0)
        if sol_count != stu_count:
            base_key, default_val = key
            label = ColorTable.describe(('FIELD',) + base_key[1:])
            default_label = repr(default_val) if default_val else '(none)'
            mismatches.append(_mismatch(
                'default_value',
                f'solution has {sol_count} field(s) of type {label} with default {default_label}; student has {stu_count}',
                solution=sol_count, student=stu_count,
            ))
    return mismatches

def _validate_check_constraints(diagram, who):
    """Validate check constraint column references within each table."""
    errors = []
    for table in diagram.tables:
        col_names = {f.name for f in table.fields}
        for f in table.fields:
            if f.check_constraint:
                errs = validate_check_constraint(f.check_constraint, f.name, col_names)
                for err in errs:
                    errors.append(_mismatch(
                        'check_constraint_invalid',
                        f'{who}: {err}',
                    ))
    return errors

def compare(solution, student):
    mismatches = []

    for code, what, target, current in (
        ('table_count', 'tables', len(solution.tables), len(student.tables)),
        ('field_count', 'fields',
         sum(len(t.fields) for t in solution.tables),
         sum(len(t.fields) for t in student.tables)),
        ('relationship_count', 'relationships',
         len(solution.relationships), len(student.relationships)),
    ):
        if target != current:
            mismatches.append(_mismatch(
                code, f'solution has {target} {what}, student has {current}', solution=target, student=current))

    mismatches += _counter_differences(
        'field_types', 'field(s) of',
        Counter(field_color_key(f) for t in solution.tables for f in t.fields),
        Counter(field_color_key(f) for t in student.tables for f in t.fields),
        describe=ColorTable.describe,
    )

    mismatches += _counter_differences(
        'table_composition', 'table(s) with fields',
        Counter(_table_signature(t) for t in solution.tables),
        Counter(_table_signature(t) for t in student.tables),
        describe=_describe_signature,
    )

    mismatches += _counter_differences(
        'cardinality', 'relationship(s) of cardinality',
        Counter(r.cardinality for r in solution.relationships),
        Counter(r.cardinality for r in student.relationships),
    )

    mismatches += _counter_differences(
        'relationship_endpoints', 'relationship(s)',
        Counter(_rel_endpoint_key(solution, r) for r in solution.relationships),
        Counter(_rel_endpoint_key(student, r) for r in student.relationships),
        describe=_describe_endpoint,
    )

    # Validate student check constraints reference valid columns
    mismatches += _validate_check_constraints(student, 'student')

    return mismatches

