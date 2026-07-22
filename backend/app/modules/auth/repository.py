"""Database access layer for authentication operations."""

from uuid import UUID
from sqlalchemy.orm import Session
from app.db.models import User, UserRole


class AuthRepository:
    """Database repository for User management operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_user(
        self,
        full_name: str,
        email: str,
        password_hash: str,
        role: UserRole = UserRole.STUDENT,
    ) -> User:
        """Create and persist a new user in the database."""
        user = User(
            full_name=full_name.strip(),
            email=email.lower().strip(),
            password_hash=password_hash,
            role=role,
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_user_by_email(self, email: str) -> User | None:
        """Retrieve user by email address."""
        return (
            self.db.query(User)
            .filter(User.email == email.lower().strip())
            .first()
        )

    def get_user_by_id(self, user_id: UUID) -> User | None:
        """Retrieve user by UUID primary key."""
        return (
            self.db.query(User)
            .filter(User.id == user_id)
            .first()
        )

    def update_password(self, user_id: UUID, new_password_hash: str) -> bool:
        """Update password hash for a given user."""
        user = self.get_user_by_id(user_id)
        if not user:
            return False
        user.password_hash = new_password_hash
        self.db.commit()
        return True
