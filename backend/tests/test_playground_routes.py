"""
Integration tests for Playground persistence & Submission evaluation routes.
"""

import pytest


def test_teacher_and_student_playground_isolation(client, teacher_auth, student_auth):
    solution_diagram = {
        "tables": [{"id": "t1", "name": "Customer", "fields": [{"id": "f1", "name": "id", "type": "int", "is_pk": True}]}],
        "relationships": [],
    }
    # 1. Teacher creates and publishes question
    q_id = client.post(
        "/questions",
        json={
            "title": "Isolation Test Question",
            "question": "Design Customer ER",
            "solution": solution_diagram,
        },
        headers=teacher_auth["headers"],
    ).json()["id"]

    client.put(f"/questions/{q_id}", json={"is_published": True}, headers=teacher_auth["headers"])

    # 2. Teacher opens playground -> is_solution MUST be True
    t_pg = client.get(f"/questions/{q_id}/playground", headers=teacher_auth["headers"]).json()
    assert t_pg["is_solution"] is True

    # 3. Student opens playground -> is_solution MUST be False
    s_pg = client.get(f"/questions/{q_id}/playground", headers=student_auth["headers"]).json()
    assert s_pg["is_solution"] is False


def test_reviewing_teacher_solution_reveal(client, teacher_auth, reviewer_auth, student_auth):
    solution_diagram = {
        "tables": [{"id": "t1", "name": "Order", "fields": [{"id": "f1", "name": "id", "type": "int", "is_pk": True}]}],
        "relationships": [],
    }
    # 1. Teacher 1 creates and publishes question
    q_id = client.post(
        "/questions",
        json={
            "title": "Order Processing",
            "question": "Design Order ER",
            "solution": solution_diagram,
        },
        headers=teacher_auth["headers"],
    ).json()["id"]

    client.put(f"/questions/{q_id}", json={"is_published": True}, headers=teacher_auth["headers"])

    # 2. Reviewing Teacher reveals official reference solution -> Allowed
    rev_res = client.get(f"/questions/{q_id}/solution", headers=reviewer_auth["headers"])
    assert rev_res.status_code == 200
    assert rev_res.json()["solution"] == solution_diagram

    # 3. Student attempts to reveal official solution -> Forbidden (403)
    stu_res = client.get(f"/questions/{q_id}/solution", headers=student_auth["headers"])
    assert stu_res.status_code == 403


def test_student_submit_solution_evaluation(client, teacher_auth, student_auth):
    diagram = {
        "tables": [{"id": "t1", "name": "Account", "fields": [{"id": "f1", "name": "id", "type": "int", "is_pk": True}]}],
        "relationships": [],
    }
    # 1. Teacher creates & publishes question
    q_id = client.post(
        "/questions",
        json={
            "title": "Account ER",
            "question": "Build Account table",
            "solution": diagram,
        },
        headers=teacher_auth["headers"],
    ).json()["id"]

    client.put(f"/questions/{q_id}", json={"is_published": True}, headers=teacher_auth["headers"])

    # 2. Student opens and saves diagram to playground
    client.get(f"/questions/{q_id}/playground", headers=student_auth["headers"])
    client.put(
        f"/questions/{q_id}/playground",
        json={"diagram_json": diagram},
        headers=student_auth["headers"],
    )

    # 3. Student submits solution
    sub_res = client.post(f"/questions/{q_id}/submit", json={}, headers=student_auth["headers"])
    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["is_valid"] is True
