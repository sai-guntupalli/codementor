# Testing Patterns

**Analysis Date:** 2026-05-15

## Test Framework

**Runner:**
- `pytest` 9.0.3
- Config section: `[tool.pytest.ini_options]` in `backend/pyproject.toml`
- `testpaths = ["tests"]` — pytest only scans `backend/tests/`

**Assertion Library:**
- Python built-in `assert` statements (no third-party assertion library)

**HTTP Testing:**
- `fastapi.testclient.TestClient` (wraps `httpx`)
- `httpx` 0.28.1 included as dev dependency

**Async Support:**
- `pytest-asyncio` 1.3.0 installed but not yet used (no async tests present)

**Run Commands:**
```bash
cd backend
uv run pytest -v              # Run all tests with verbose output
uv run pytest                 # Run all tests (quiet)
make test                     # Alias: uv run pytest -v
make check                    # lint + format check + pytest -v
```

**No coverage tooling configured** — no `pytest-cov`, no coverage threshold defined.

## Test File Organization

**Location:** All tests in `backend/tests/` — no co-location with source files.

**Naming convention:** `test_<subject>.py` where subject is the domain area being tested:
- `tests/test_health.py` — API endpoint tests
- `tests/test_db_connection.py` — database schema and seed data tests

**`__init__.py` present** in `backend/tests/` to make it a package.

**Fixtures file:** `backend/tests/conftest.py` — shared fixtures available to all test modules automatically via pytest discovery.

```
backend/
└── tests/
    ├── __init__.py
    ├── conftest.py          # Shared fixtures
    ├── test_db_connection.py
    └── test_health.py
```

## Test Structure

**Suite Organization (no `describe`-style grouping):**
Tests are flat functions within a module — no class-based test grouping used.

```python
# tests/test_db_connection.py
EXPECTED_TABLES = { "users", "organizations", ... }   # module-level constant

def test_database_is_reachable():
    ...

def test_all_tables_exist():
    ...

def test_plans_seeded(db):           # uses conftest fixture
    ...

def test_prompts_seeded(db):         # uses conftest fixture
    ...
```

**Naming:** Every test function prefixed with `test_`, named as `test_<what_it_verifies>`:
- `test_database_is_reachable`
- `test_all_tables_exist`
- `test_health_returns_ok`
- `test_plans_seeded`
- `test_prompts_seeded`

## Fixtures (conftest.py)

**Location:** `backend/tests/conftest.py`

**Defined fixtures:**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db.session import SessionLocal
from main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db() -> Session:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
```

**`client` fixture:**
- Creates a `TestClient` wrapping the FastAPI `app`
- No session scope set — new instance per test function (default `function` scope)

**`db` fixture:**
- Opens a real `SessionLocal()` database session
- Uses `yield` + `finally` to guarantee `session.close()` on teardown
- Connects to the actual database (from `settings.database_url` / `.env`)
- No transaction rollback — tests run against real data; seed data must be present

## Test Patterns

**API endpoint test (uses `client` fixture):**
```python
# tests/test_health.py
def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

**Database connectivity test (direct engine usage, no fixture):**
```python
# tests/test_db_connection.py
from sqlalchemy import inspect, text
from db.session import engine

def test_database_is_reachable():
    with engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1
```

**Schema existence test (set arithmetic):**
```python
EXPECTED_TABLES = {
    "users", "organizations", "org_members",
    "plans", "subscriptions", "usage_events",
    ...
}

def test_all_tables_exist():
    existing = set(inspect(engine).get_table_names())
    missing = EXPECTED_TABLES - existing
    assert not missing, f"Missing tables: {missing}"
```

**Seed data assertion (uses `db` fixture):**
```python
def test_plans_seeded(db):
    from models.billing import Plan
    assert db.query(Plan).count() >= 2

def test_prompts_seeded(db):
    from models.content import Prompt
    expected = {"code_review", "hint_generator", ...}
    existing = {p.name for p in db.query(Prompt).all()}
    assert not expected - existing, f"Missing prompts: {expected - existing}"
```
Note: model imports inside test functions (not at module top) — this is the observed pattern for seed tests.

## Mocking

**No mocking framework in use.** No `unittest.mock`, `pytest-mock`, or `MagicMock` patterns present.

Current tests connect to a real database and real FastAPI app — integration-style, not unit tests.

When mocking is needed in future tests, `unittest.mock` from the standard library or `pytest-mock` (not yet a dependency) are the expected options given the existing pytest setup.

## Fixtures and Factories

**No factory library** (no `factory_boy`, `faker`, or similar).

**Test data approach:** Tests assert against seeded data inserted by `seeds/plans.py` and `seeds/prompts.py`. Tests assume seed scripts have been run before the test suite.

**No in-memory database or test-specific fixtures** for creating throwaway records — all DB tests hit the live database.

## Coverage

**Requirements:** None enforced. No `pytest-cov` installed, no `--cov` flag in Makefile.

**View Coverage:** Not configured.

## Test Types

**Integration Tests (current):**
All existing tests are integration tests — they require a live PostgreSQL database connection and the application's real configuration loaded from `.env`.
- `test_db_connection.py`: schema existence + seed data
- `test_health.py`: HTTP endpoint via TestClient

**Unit Tests:** None present.

**E2E Tests:** Not used. No Playwright, Cypress, or similar tooling.

**Frontend Tests:** No test framework configured in the frontend (`frontend/package.json` has no test script, no Jest/Vitest).

## Common Patterns

**Assertion style — equality:**
```python
assert response.status_code == 200
assert response.json() == {"status": "ok"}
assert conn.execute(text("SELECT 1")).scalar() == 1
```

**Assertion style — set difference with descriptive message:**
```python
assert not missing, f"Missing tables: {missing}"
assert not expected - existing, f"Missing prompts: {expected - existing}"
```

**Assertion style — count:**
```python
assert db.query(Plan).count() >= 2
```

**No `pytest.raises` patterns** present yet (no error path testing).

**No parametrize patterns** (`@pytest.mark.parametrize`) present yet.

## Running Tests Prerequisites

Tests require a running PostgreSQL instance with:
1. `.env` file present in `backend/` with `DATABASE_URL` set
2. Alembic migrations applied: `alembic upgrade head`
3. Seed data loaded: `uv run python -m seeds.plans && uv run python -m seeds.prompts`

Without these, `test_db_connection.py` and `test_health.py` (which starts the app) will fail.

---

*Testing analysis: 2026-05-15*
