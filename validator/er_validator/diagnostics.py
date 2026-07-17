# This file will be used before running bliss as bliss can take time, so we remove the obvious wrong answer
# by comparing count of tables, relation, fields, etc. So that bliss does not take that much time 

from .graphBuilder import field_color_key, ColorTable
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

    return mismatches
