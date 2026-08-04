"""
Pytest configuration and global fixtures for backend test suite.
"""

import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """
    FastAPI TestClient fixture for invoking endpoints in memory.
    """
    return TestClient(app)


@pytest.fixture
def teacher_auth(client):
    """
    Registers and returns auth credentials for a test Teacher user.
    """
    import uuid
    email = f"teacher_{uuid.uuid4().hex[:6]}@nst.edu"
    password = "Pass123!"
    res = client.post(
        "/auth/register",
        json={
            "full_name": "Test Teacher",
            "email": email,
            "password": password,
            "role": "TEACHER",
        },
    )
    assert res.status_code in (200, 201), f"Registration failed: {res.text}"
    token = res.json()["access_token"]
    user_data = res.json()["user"]
    return {
        "token": token,
        "user": user_data,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def reviewer_auth(client):
    """
    Registers and returns auth credentials for a Reviewing Teacher user.
    """
    import uuid
    email = f"reviewer_{uuid.uuid4().hex[:6]}@nst.edu"
    password = "Pass123!"
    res = client.post(
        "/auth/register",
        json={
            "full_name": "Reviewer Teacher",
            "email": email,
            "password": password,
            "role": "TEACHER",
        },
    )
    assert res.status_code in (200, 201), f"Registration failed: {res.text}"
    token = res.json()["access_token"]
    user_data = res.json()["user"]
    return {
        "token": token,
        "user": user_data,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def student_auth(client):
    """
    Registers and returns auth credentials for a test Student user.
    """
    import uuid
    email = f"student_{uuid.uuid4().hex[:6]}@nst.edu"
    password = "Pass123!"
    res = client.post(
        "/auth/register",
        json={
            "full_name": "Test Student",
            "email": email,
            "password": password,
            "role": "STUDENT",
        },
    )
    assert res.status_code in (200, 201), f"Registration failed: {res.text}"
    token = res.json()["access_token"]
    user_data = res.json()["user"]
    return {
        "token": token,
        "user": user_data,
        "headers": {"Authorization": f"Bearer {token}"},
    }
