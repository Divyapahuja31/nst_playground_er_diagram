# ER Diagram Validator Backend

A high-performance Python FastAPI backend powering the ER Diagram Evaluation Platform. It handles automatic grading of entity-relationship (ER) diagram submissions using graph-isomorphism algorithms, fuzzy entity-name matching, domain-specific semantic ontologies, and PostgreSQL persistence via SQLAlchemy 2.0 and Alembic.

---

## Overview

The ER Diagram Validator Backend serves as the central API and validation engine for the ER Diagram Evaluation Platform. It fulfills five core responsibilities:

1. **Diagram Validation** — Compares student-submitted ER diagrams against reference solutions using graph-isomorphism and multi-stage entity name matching.
2. **Question Bank Management** — Stores and manages graded ER diagram problems, reference solutions, and metadata.
3. **Playground Management** — Manages diagram states across practice diagrams, instructor solution models, and student assignments.
4. **Submission Evaluation** — Records point-in-time submission snapshots, validation scores, and structured diagnostic feedback.
5. **REST API Gateway** — Exposes RESTful endpoints for integration with web client frontends.

---

## Architecture

The backend follows a layered, modular architecture:

```
[ Web Frontend ]
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ REST API Layer (FastAPI / Uvicorn)                       │
└───────────┬─────────────────────────────────────────────┘
            │
    ┌───────┴────────────────────────┐
    ▼                                ▼
┌─────────────────────────┐    ┌──────────────────────────┐
│ Validation Engine       │    │ Database Layer           │
│ ├─ Diagnostics          │    │ ├─ SQLAlchemy 2.0 ORM    │
│ ├─ Graph Builder        │    │ ├─ Neon PostgreSQL       │
│ ├─ Isomorphism (Bliss)  │    │ └─ Alembic Migrations    │
│ └─ Name Matcher         │    └──────────────────────────┘
└─────────────────────────┘
```

### Key Modules

- **FastAPI** — High-speed ASGI web framework providing routing, validation, and documentation generation.
- **Validator Engine** — Decoupled core library that parses JSON diagram structures, builds vertex-colored undirected graphs, executes graph isomorphism routines, and scores entity name similarity.
- **Database Layer** — Asynchronous-ready relational layer using SQLAlchemy 2.0 ORM backed by cloud PostgreSQL (Neon).
- **Alembic** — Database schema migration tool managing incremental versioning and DDL tracking.

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                   # FastAPI application entry point and route handlers
│   │
│   ├── core/                     # Infrastructure & configuration
│   │   ├── config.py             # Environment variable parsing and global settings
│   │   ├── constants.py          # Shared application constants
│   │   ├── exceptions.py         # Custom application exceptions
│   │   └── security.py           # Security and authentication placeholders
│   │
│   ├── db/                       # Persistence layer
│   │   ├── db.py                 # SQLAlchemy engine, session maker, Base declaration
│   │   ├── models.py             # Production ORM models (User, Question, Playground, etc.)
│   │   └── store.py              # Data access operations and seed data loader
│   │
│   └── validator/                # Core evaluation engine
│       ├── core.py               # Validation pipeline orchestrator
│       ├── schema.py             # Diagram parser and dataclass models
│       ├── graphBuilder.py       # Diagram-to-graph translation module
│       ├── diagnostics.py        # Structural heuristics pre-checker
│       ├── name_matcher.py       # Multi-stage entity name matching
│       ├── ontology.json         # Domain-specific synonym dictionary
│       └── engine/               # Isomorphism engine interfaces

│           ├── base.py           # Engine interface definition and registry
│           ├── native.py         # Subprocess runner for binary solvers
│           └── bliss_engine.py   # Bliss DIMACS format builder and parser
│
├── alembic/                      # Database migration environment
│   ├── versions/                 # Revision scripts
│   └── env.py                    # Migration environment script
│
├── .env.example                  # Environment configuration template
├── alembic.ini                   # Alembic configuration settings
├── Dockerfile                    # Containerization instructions
├── requirements.txt              # Python package dependencies
└── setup.sh                      # Build script for Bliss graph isomorphism binary
```

---

## Prerequisites

Ensure the following tools are installed on your host system before proceeding:

- **Python 3.12+**
- **Git**
- **C++ Build Tools & CMake** (required for building the Bliss binary; run `xcode-select --install` on macOS or install `build-essential` on Linux)
- **PostgreSQL Database** (e.g., [Neon PostgreSQL](https://neon.tech/))

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/nst_playground_er_diagram.git
cd nst_playground_er_diagram/backend
```

### 2. Create and Activate a Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

On Windows:

```cmd
.venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt uvicorn
```

### 4. Build Native Binaries (`setup.sh`)

Before starting the server, you must run `setup.sh` to download and compile the Bliss graph isomorphism binary:

```bash
bash setup.sh
```

This script performs the following:
- Downloads the Bliss graph isomorphism library into `backend/vendor/bliss`.
- Compiles the native binary using `cmake`.
- Writes a path registry to `backend/vendor/paths.json`.

---

## Environment Variables

Create a `.env` file in the `backend/` directory by copying `.env.example`:

```bash
cp .env.example .env
```

### Configuration Parameters

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection URI | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `VALIDATOR_ALGORITHM` | No | Isomorphism solver engine (`bliss` or `native`) | `bliss` |
| `JWT_SECRET` | No | Secret key for JWT authentication tokens (future) | `super-secret-key-change-in-production` |

---

## Database Management & Migrations

Database schema tracking is handled via **Alembic**.

### Apply Existing Migrations

To bring your Neon PostgreSQL database up to date with the latest schema:

```bash
alembic upgrade head
```

### Generate a New Migration

After modifying SQLAlchemy models in `app/db/models.py`, generate a new migration revision script:

```bash
alembic revision --autogenerate -m "describe_schema_changes"
```

### Roll Back Migrations

To revert the most recent database migration:

```bash
alembic downgrade -1
```

---

## Running the Backend

Make sure your virtual environment is activated (`source .venv/bin/activate`), or call the binaries directly from `.venv/bin/`.

Start the development server with hot reloading enabled:

```bash
# Option A: With virtual environment activated
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Option B: Direct path
.venv/bin/uvicorn app.main:app --reload --port 8000
```


The application will launch on **`http://localhost:8000`**.

- API Base Endpoint: `http://localhost:8000`
- Health Check: `http://localhost:8000/health`

---

## API Documentation

FastAPI automatically generates interactive OpenAPI documentation. Once the server is running, access the documentation in your browser:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc UI**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Development Workflow

To contribute to this codebase, follow this workflow:

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Implement Changes**
   Write code, following PEP 8 conventions and project architecture guidelines.
3. **Generate Database Migrations (If Schema Modified)**
   ```bash
   alembic revision --autogenerate -m "add_new_feature_tables"
   alembic upgrade head
   ```
4. **Test Implementation**
   Verify API routes locally via Swagger UI (`/docs`).
5. **Open a Pull Request**
   Push changes to remote repository and create a Pull Request against `main`.

---

## Current Features

- **ER Diagram Validation Engine** — Graph isomorphism evaluation via native Bliss solver and fallback pure-Python engine.
- **Diagnostic Heuristics** — Pre-check verification of entity counts, relationship cardinalities, and field type distributions.
- **Semantic & Fuzzy Name Matching** — Entity name scoring using Jaro-Winkler, Levenshtein, and custom domain ontologies.
- **Question Bank CRUD** — Persistent storage for problem statements and instructor solutions.
- **Relational Persistence** — Production PostgreSQL database schema with SQLAlchemy 2.0 ORM.
- **Schema Version Control** — DDL migrations managed through Alembic.
- **Interactive Documentation** — Automated Swagger UI and ReDoc endpoints.

## Technology Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| Language | Python 3.12+ | Core programming language |
| Web Framework | FastAPI | ASGI framework for web APIs |
| ORM | SQLAlchemy 2.0 | Object-Relational Mapping library |
| Database Migration | Alembic | Database DDL migration tool |
| Database Engine | Neon PostgreSQL | Cloud Serverless PostgreSQL database |
| Graph Isomorphism | Bliss | Native C++ graph automorphism solver |
| Containerization | Docker | Application container environment |

---

