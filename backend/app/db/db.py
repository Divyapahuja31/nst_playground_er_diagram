import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env file if present
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is missing. "
        "Please create a .env file in backend/ containing your Neon connection string:\n"
        "DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require"
    )

# Fix dialect prefix if standard postgresql:// URL is provided for Neon
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    connect_args["keepalives"] = 1
    connect_args["keepalives_idle"] = 30
    connect_args["keepalives_interval"] = 10
    connect_args["keepalives_count"] = 5

from sqlalchemy.pool import NullPool

engine_kwargs = {
    "connect_args": connect_args,
}

if "-pooler" in DATABASE_URL:
    # Neon PgBouncer pooler operates in transaction mode.
    # NullPool prevents SQLAlchemy from holding dead client sockets across transactions.
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(
    DATABASE_URL,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
