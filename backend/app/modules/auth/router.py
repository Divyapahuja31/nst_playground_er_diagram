"""FastAPI router defining HTTP endpoints for authentication."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.models import User
from app.modules.auth.dependencies import get_current_user, get_db
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Helper to instantiate AuthService with AuthRepository."""
    return AuthService(AuthRepository(db))


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
):
    """Register a new student, teacher, or admin user."""
    return service.register(payload)


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and obtain access token",
)
def login(
    payload: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    """Authenticate user with email and password to receive a Bearer JWT access token."""
    return service.login(payload)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
def me(
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    """Retrieve profile details for the currently authenticated user."""
    return service.me(current_user)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Log out current user",
)
def logout(
    current_user: User = Depends(get_current_user),
):
    """Log out the current user session."""
    return {"message": "Successfully logged out"}
