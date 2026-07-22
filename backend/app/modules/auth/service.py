"""Business logic service for authentication operations."""

from fastapi import HTTPException, status
from app.db.models import User
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserResponse,
)
from app.modules.auth.utils import (
    create_access_token,
    hash_password,
    verify_password,
)


class AuthService:
    """Service orchestrating input validation, security hashing, JWT generation, and repository calls."""

    def __init__(self, repo: AuthRepository):
        self.repo = repo

    def register(self, payload: RegisterRequest) -> RegisterResponse:
        """Register a new user, hash password, generate JWT token, and return response."""
        existing_user = self.repo.get_user_by_email(payload.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered",
            )

        hashed_pw = hash_password(payload.password)
        user = self.repo.create_user(
            full_name=payload.full_name,
            email=payload.email,
            password_hash=hashed_pw,
            role=payload.role,
        )

        token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        })

        return RegisterResponse(
            user=UserResponse.model_validate(user),
            access_token=token,
            token_type="bearer",
        )

    def login(self, payload: LoginRequest) -> LoginResponse:
        """Authenticate user credentials, check active status, generate JWT token, and return response."""
        user = self.repo.get_user_by_email(payload.email)

        # Generic authentication error to prevent email enumeration attacks
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )

        token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        })

        return LoginResponse(
            user=UserResponse.model_validate(user),
            access_token=token,
            token_type="bearer",
        )

    def me(self, current_user: User) -> UserResponse:
        """Format and return current authenticated user's profile."""
        return UserResponse.model_validate(current_user)
