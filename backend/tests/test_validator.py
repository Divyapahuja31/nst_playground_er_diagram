"""
Unit tests for app.validator.core (Graph builder, Bliss engine, Isomorphism).
"""

import pytest
from app.validator.core import validate


def test_identical_diagram_validation():
    diagram = {
        "tables": [
            {
                "id": "t1",
                "name": "User",
                "fields": [
                    {"id": "f1", "name": "id", "type": "int", "is_pk": True, "is_null": False, "is_unique": True}
                ],
            }
        ],
        "relationships": [],
    }
    res = validate(diagram, diagram, algorithm="bliss")
    assert res["is_valid"] is True
    assert res["status"]["engine_ran"] is True
    assert len(res["mismatches"]) == 0


def test_mismatched_relationship_cardinality():
    teacher = {
        "tables": [
            {"id": "t1", "name": "User", "fields": [{"id": "f1", "name": "id", "type": "int", "is_pk": True}]},
            {"id": "t2", "name": "Post", "fields": [{"id": "f2", "name": "id", "type": "int", "is_pk": True}]},
        ],
        "relationships": [
            {
                "id": "r1",
                "startTable": "t1",
                "startField": "f1",
                "endTable": "t2",
                "endField": "f2",
                "cardinality": "one_to_many",
            }
        ],
    }
    student = {
        "tables": [
            {"id": "t1", "name": "User", "fields": [{"id": "f1", "name": "id", "type": "int", "is_pk": True}]},
            {"id": "t2", "name": "Post", "fields": [{"id": "f2", "name": "id", "type": "int", "is_pk": True}]},
        ],
        "relationships": [
            {
                "id": "r1",
                "startTable": "t1",
                "startField": "f1",
                "endTable": "t2",
                "endField": "f2",
                "cardinality": "one_to_one",  # Different cardinality
            }
        ],
    }
    res = validate(teacher, student, algorithm="bliss")
    assert res["is_valid"] is False
    assert len(res["mismatches"]) > 0
