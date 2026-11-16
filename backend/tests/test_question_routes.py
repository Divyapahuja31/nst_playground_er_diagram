"""
Integration tests for Question Management routes (/questions).
"""

import pytest


def test_create_question_by_teacher(client, teacher_auth):
    solution_diagram = {
        "tables": [{"id": "t1", "name": "User", "fields": [{"id": "f1", "name": "id", "type": "int", "is_pk": True}]}],
        "relationships": [],
    }
    res = client.post(
        "/questions",
        json={
            "title": "E-Commerce ER Diagram",
            "question": "Build an ER diagram for an e-commerce platform.",
            "solution": solution_diagram,
        },
        headers=teacher_auth["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert "id" in data


def test_student_cannot_view_unpublished_question(client, teacher_auth, student_auth):
    # 1. Teacher creates unpublished question
    q_res = client.post(
        "/questions",
        json={
            "title": "Draft ER Diagram",
            "question": "Draft description.",
            "solution": {"tables": [], "relationships": []},
        },
        headers=teacher_auth["headers"],
    )
    q_id = q_res.json()["id"]

    # 2. Student attempts to get question -> should return 403
    stu_res = client.get(f"/questions/{q_id}", headers=student_auth["headers"])
    assert stu_res.status_code == 403

    # Clean up
    client.delete(f"/questions/{q_id}", headers=teacher_auth["headers"])


def test_student_can_view_published_question_without_solution(client, teacher_auth, student_auth):
    solution = {"tables": [{"id": "t1", "name": "User", "fields": [{"id": "f1", "name": "id", "type": "int"}]}], "relationships": []}
    # 1. Teacher creates question
    q_res = client.post(
        "/questions",
        json={
            "title": "Published ER Question",
            "question": "Public description.",
            "solution": solution,
        },
        headers=teacher_auth["headers"],
    )
    q_id = q_res.json()["id"]

    # 2. Teacher publishes question
    pub_res = client.put(f"/questions/{q_id}", json={"is_published": True}, headers=teacher_auth["headers"])
    assert pub_res.status_code == 200

    # 3. Student views question -> solution must NOT be leaked
    stu_res = client.get(f"/questions/{q_id}", headers=student_auth["headers"])
    assert stu_res.status_code == 200
    q_data = stu_res.json()
    assert q_data["title"] == "Published ER Question"
    assert "solution" not in q_data or q_data.get("solution") == {}

    # Clean up
    client.delete(f"/questions/{q_id}", headers=teacher_auth["headers"])


def test_teacher_can_publish_unpublish_and_delete_question(client, teacher_auth):
    """Teachers can toggle question publish status and delete questions."""
    solution = {"tables": [{"id": "t1", "name": "Item", "fields": [{"id": "f1", "name": "id", "type": "int"}]}], "relationships": []}
    # 1. Create question
    create_res = client.post(
        "/questions",
        json={
            "title": "To Delete Question",
            "question": "Will be deleted.",
            "solution": solution,
        },
        headers=teacher_auth["headers"],
    )
    assert create_res.status_code == 200
    q_id = create_res.json()["id"]

    # 2. Publish question
    pub_res = client.put(f"/questions/{q_id}", json={"is_published": True}, headers=teacher_auth["headers"])
    assert pub_res.status_code == 200
    get_pub = client.get(f"/questions/{q_id}", headers=teacher_auth["headers"])
    assert get_pub.json()["is_published"] is True

    # 3. Unpublish question
    unpub_res = client.put(f"/questions/{q_id}", json={"is_published": False}, headers=teacher_auth["headers"])
    assert unpub_res.status_code == 200
    get_unpub = client.get(f"/questions/{q_id}", headers=teacher_auth["headers"])
    assert get_unpub.json()["is_published"] is False

    # 4. Delete question
    del_res = client.delete(f"/questions/{q_id}", headers=teacher_auth["headers"])
    assert del_res.status_code == 200
    assert del_res.json() == {"ok": True}

    # 5. Subsequent GET should 404
    get_del = client.get(f"/questions/{q_id}", headers=teacher_auth["headers"])
    assert get_del.status_code == 404


def test_student_cannot_delete_question(client, teacher_auth, student_auth):
    """Students are rejected with 403 when attempting to delete questions."""
    create_res = client.post(
        "/questions",
        json={
            "title": "Protected Question",
            "question": "Students cannot delete.",
            "solution": {"tables": [], "relationships": []},
        },
        headers=teacher_auth["headers"],
    )
    q_id = create_res.json()["id"]

    del_res = client.delete(f"/questions/{q_id}", headers=student_auth["headers"])
    assert del_res.status_code == 403
