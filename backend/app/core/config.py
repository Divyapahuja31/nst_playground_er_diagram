"""Application configuration — loaded from environment / .env file."""

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./portal.db")
VALIDATOR_ALGORITHM: str = os.getenv("VALIDATOR_ALGORITHM") or "bliss"

# Authentication settings
JWT_SECRET: str = os.getenv("JWT_SECRET") or "super-secret-jwt-key-change-in-production"
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "1440")
