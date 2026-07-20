# NST Playground — ER Diagram Validator

A full-stack tool for automatically grading student **Entity-Relationship (ER) diagram** submissions. It compares a student's diagram against an instructor-provided reference solution using graph-isomorphism and fuzzy name-matching, returning a detailed structured report.

---

## Repository Structure

```
nst_playground_er_diagram/
├── frontend/          # React + Vite UI (TailwindCSS, React Flow)
└── validator/         # FastAPI backend (Python)
    ├── er_validator/  # Core validation package
    │   ├── api.py           # FastAPI routes
    │   ├── core.py          # Orchestrates the full validation pipeline
    │   ├── schema.py        # Diagram data-model & parser
    │   ├── graphBuilder.py  # Converts diagrams to vertex-colored graphs
    │   ├── diagnostics.py   # Fast pre-check (counts & types) before graph iso
    │   ├── name_matcher.py  # Entity name comparison (exact / semantic / fuzzy)
    │   ├── store.py         # SQLite question bank (CRUD)
    │   ├── ontology.json    # Domain synonym groups for semantic matching
    │   ├── seed_questions.json  # Seed data loaded on first run
    │   └── engine/
    │       ├── base.py          # Abstract IsomorphismEngine + engine registry
    │       ├── bliss_engine.py  # Bliss graph-iso binary wrapper (default)
    │       └── native.py        # Pure-Python fallback engine
    ├── requirements.txt
    └── setup.sh       # Clones and links the Bliss binary
```

---

## How It Works

### Validation Pipeline

1. **Parse** — Both the reference and student diagram JSON documents are parsed into typed Python dataclasses (`Table`, `Field`, `Relationship`).
2. **Diagnostics pre-check** — Table count, field count, relationship count, field types, table compositions, and relationship cardinalities are compared. Any mismatch is returned immediately without running the expensive graph-isomorphism step.
3. **Graph construction** — Each diagram is converted to a vertex-colored undirected graph where node colours encode field type, constraints (PK, NOT NULL, UNIQUE, etc.), and cardinality.
4. **Graph isomorphism** — The two coloured graphs are tested for isomorphism using the **Bliss** engine (or a pure-Python fallback). An isomorphic result means the relationship wiring is structurally equivalent.
5. **Name matching** — Entity (table) names are compared in three stages of decreasing confidence:
   - **Exact** — identical after normalization (camelCase splitting, lowercasing, singularization).
   - **Semantic** — both names appear in the same synonym group in `ontology.json`.
   - **Fuzzy** — closest pair above a similarity threshold using max(Jaro-Winkler, Levenshtein).

### Validation Response

```json
{
  "is_valid": true,
  "algorithm_used": "bliss",
  "mismatches": [],
  "names": {
    "score": 95,
    "matched": [...],
    "missing": [],
    "extra": []
  },
  "status": {
    "expected_nodes": 12,
    "student_nodes": 12,
    "expected_edges": 8,
    "student_edges": 8,
    "engine_ran": true,
    "engine_ms": 1.234
  }
}
```

---

## Setup

### Prerequisites

- Python ≥ 3.10
- Node.js ≥ 18
- A C++ build toolchain (for Bliss — `xcode-select --install` on macOS)

### Backend

```bash
cd validator

# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Download and link the Bliss binary
bash setup.sh

# 4. Start the API server
uvicorn er_validator.api:app --reload
```

The API will be available at `http://localhost:8000`.

> **Tip:** Set the `VALIDATOR_ALGORITHM` environment variable to `native` to use the pure-Python engine and skip the Bliss setup (slower for large graphs).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at `http://localhost:5173`.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/validate` | Validate a student diagram against a reference |
| `POST` | `/compare-names` | Compare two lists of entity names only |
| `GET` | `/questions` | List all questions in the question bank |
| `POST` | `/questions` | Create a new question |
| `GET` | `/questions/{id}` | Get a question (solution excluded by default) |
| `DELETE` | `/questions/{id}` | Delete a question |
| `POST` | `/questions/{id}/submit` | Submit a student diagram for a stored question |

### `POST /validate`

```json
{
  "expected_solution": { "title": "...", "tables": [...], "relationships": [...] },
  "student_solution":  { "title": "...", "tables": [...], "relationships": [...] },
  "algorithm": "bliss"
}
```

### `POST /compare-names`

```json
{
  "expected_solution": ["Customer", "OrderDetails", "Product"],
  "student_solution":  ["customers", "order_detail", "Products"],
  "similarity_threshold": 0.8
}
```

---

## Diagram JSON Format

```json
{
  "title": "E-Commerce Schema",
  "tables": [
    {
      "id": 1,
      "name": "Customer",
      "fields": [
        {
          "id": 101,
          "name": "id",
          "type": "INT",
          "primaryKey": true,
          "notNull": true,
          "unique": false,
          "increment": true,
          "def": ""
        }
      ]
    }
  ],
  "relationships": [
    {
      "id": 1,
      "cardinality": "many_to_one",
      "startTable": 2,
      "startField": 201,
      "endTable": 1,
      "endField": 101
    }
  ]
}
```

Supported `cardinality` values: `many_to_one`, `one_to_one`, `one_to_many` (normalized to `many_to_one` internally).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS 4, React Flow (`@xyflow/react`) |
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite (via `store.py`) |
| Graph isomorphism | [Bliss](https://users.aalto.fi/~tjunttil/bliss/) (native binary) / pure-Python fallback |
| Name matching | Custom Jaro-Winkler + Levenshtein + ontology-based semantic matching |

---

## Development Notes

- The SQLite database (`portal.db`) is auto-created at `validator/portal.db` on first startup and seeded from `seed_questions.json` if the questions table is empty.
- The `ontology.json` file contains domain-specific synonym groups (e.g., `["user", "member", "account"]`) used for semantic name matching. Add new groups here to expand coverage.
- The `VALIDATOR_ALGORITHM` environment variable controls which isomorphism engine is used (`bliss` or `native`).
