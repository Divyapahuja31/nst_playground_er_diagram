"""
Unit tests for app.validator.name_matcher (Normalization, Ontology, Fuzzy matching).
"""

import pytest
from app.validator.name_matcher import (
    singularize,
    normalize_name,
    compare_entities,
)


def test_singularize():
    assert singularize("users") == "user"
    assert singularize("categories") == "category"
    assert singularize("people") == "person"
    assert singularize("children") == "child"
    assert singularize("data") == "data"  # Uncountable
    assert singularize("status") == "status"


def test_normalize_name():
    assert normalize_name("User_Accounts") == "user account"
    assert normalize_name("order_items") == "order item"
    assert normalize_name("customerID") == "customer id"


def test_exact_name_match():
    expected = ["User", "Account"]
    student = ["User", "Account"]
    res = compare_entities(expected, student)
    assert res["score"] == 100
    assert len(res["missing"]) == 0
    assert len(res["extra"]) == 0
    assert len(res["matched"]) == 2


def test_synonym_ontology_match():
    # Customer vs Client in ontology.json
    expected = ["Customer"]
    student = ["Client"]
    res = compare_entities(expected, student)
    assert res["score"] > 70
    assert len(res["matched"]) == 1
    assert "type" in res["matched"][0]


def test_missing_and_extra_detection():
    expected = ["User", "Order"]
    student = ["User", "Payment"]
    res = compare_entities(expected, student)
    missing_names = res["missing"]
    extra_names = res["extra"]

    assert "Order" in missing_names
    assert "Payment" in extra_names
