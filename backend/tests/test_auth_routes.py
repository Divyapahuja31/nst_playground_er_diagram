"""
Integration tests for Auth & User Management routes (/auth/register, /auth/login, /auth/me).
"""

import uuid
import pytest


def test_user_registration(client):
    email = f"user_{uuid.uuid4().hex[:6]}@nst.edu"
    res = client.post(
        "/auth/register",
        json={
            "full_name": "John Doe",
            "email": email,
            "password": "Password123!",
            "role": "STUDENT",
        },
    )
    assert res.status_code in (200, 201)
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "STUDENT"


def test_duplicate_registration_fails(client):
    email = f"dup_{uuid.uuid4().hex[:6]}@nst.edu"
    payload = {
        "full_name": "Jane Doe",
        "email": email,
        "password": "Password123!",
        "role": "STUDENT",
    }
    res1 = client.post("/auth/register", json=payload)
    assert res1.status_code in (200, 201)

    res2 = client.post("/auth/register", json=payload)
    assert res2.status_code in (400, 409)
    assert "already registered" in res2.json()["detail"].lower() or "exists" in res2.json()["detail"].lower()


def test_user_login(client):
    email = f"login_{uuid.uuid4().hex[:6]}@nst.edu"
    password = "MySecurePassword123!"
    client.post(
        "/auth/register",
        json={
            "full_name": "Login User",
            "email": email,
            "password": password,
            "role": "TEACHER",
        },
    )

    res = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "TEACHER"


def test_invalid_login_credentials(client):
    res = client.post(
        "/auth/login",
        json={"email": "nonexistent@nst.edu", "password": "WrongPassword"},
    )
    assert res.status_code in (400, 401)
