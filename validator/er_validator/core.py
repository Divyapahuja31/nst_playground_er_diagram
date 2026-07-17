import os

from .diagnostics import compare
from .engine.base import get_engine
from .graphBuilder import ColorTable, build_graph
from .name_matcher import compare_entities
from .schema import parse_diagram

DEFAULT_ALGORITHM = 'bliss'


def default_algorithm():
    return os.environ.get('VALIDATOR_ALGORITHM', DEFAULT_ALGORITHM)


def validate(expected_solution_doc, student_solution_doc, algorithm=None):
    engine = get_engine(algorithm or default_algorithm())

    expected_solution = parse_diagram(expected_solution_doc, who='expected_solution')
    student_solution = parse_diagram(student_solution_doc, who='student_solution')

    colors = ColorTable()  
    tg = build_graph(expected_solution, colors)
    sg = build_graph(student_solution, colors)

    status = {
        'expected_nodes': tg.length, 'student_nodes': sg.length,
        'expected_edges': len(tg.edges), 'student_edges': len(sg.edges),
        'engine_ran': False, 'engine_ms': None,
    }

    mismatches = compare(expected_solution, student_solution)
    if not mismatches:
        result = engine.are_isomorphic(tg, sg)
        status['engine_ran'] = True
        status['engine_ms'] = round(result.engine_ms, 3)
        if not result.isomorphic:
            mismatches.append({
                'code': 'structural',
                'message': 'field counts, types and constraints all match, '
                           'but the relationship wiring differs from the reference model',
                'expected_solution': None, 'student_solution': None,
            })

    names = compare_entities(
        [table.name for table in expected_solution.tables],
        [table.name for table in student_solution.tables],
    )

    return {
        'is_valid': not mismatches,
        'algorithm_used': engine.name,
        'mismatches': mismatches,
        'names': names,
        'status': status,
    }
