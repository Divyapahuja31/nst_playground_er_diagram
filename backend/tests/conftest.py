"""
Pytest configuration and global fixtures for backend test suite.
"""

import sys
import os

# 1. Force DATABASE_URL to an isolated test SQLite DB before any app code imports it
TEST_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_suite.db"))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from app.db.db import engine, Base
from app.db import models
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_isolated_test_database():
    """Creates schema in isolated test SQLite db for test session and deletes it after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass


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
