# Coding Conventions

**Analysis Date:** 2026-05-15

## Naming Patterns

**Files:**
- Python: `snake_case.py` — `models/users.py`, `core/config.py`, `db/session.py`, `seeds/plans.py`
- TypeScript/TSX: `kebab-case.tsx` for components — `components/ui/button.tsx`, `lib/utils.ts`
- Test files: `test_<subject>.py` — `tests/test_health.py`, `tests/test_db_connection.py`

**Classes (Python):**
- PascalCase — `Organization`, `OrgMember`, `UsageEvent`, `SkillSnapshot`, `CurriculumPath`
- SQLAlchemy models use PascalCase singular nouns even when the table is plural (`User` → `"users"`)

**Functions (Python):**
- `snake_case` — `seed_plans()`, `seed_prompts()`, `get_db()`, `health_check()`
- Seed entry points named `seed_<plural>()` — `seed_plans()`, `seed_prompts()`
- FastAPI dependency injectors named `get_<resource>()` — `get_db()`

**Variables (Python):**
- `snake_case` — `session_local`, `stripe_price_id`, `llm_calls_per_month`, `cancel_at_period_end`
- Database session variable always named `db` — `def seed_plans(): db = SessionLocal()`

**Constants (Python):**
- `UPPER_SNAKE_CASE` — `EXPECTED_TABLES`, `PROMPTS`

**Functions/Variables (TypeScript):**
- camelCase for functions and variables — `buttonVariants`, `cn()`
- PascalCase for React components — `Button`, `RootLayout`, `Home`

**TypeScript Types/Interfaces:**
- PascalCase with `Props` suffix for component prop types — `ButtonPrimitive.Props`

## Code Style

**Python Formatting:**
- Tool: `ruff format` (configured in `pyproject.toml`)
- Line length: 100 characters
- Target: Python 3.12

**Python Linting:**
- Tool: `ruff check` with rule sets `E` (pycodestyle), `F` (pyflakes), `I` (isort)
- Config file: `backend/pyproject.toml`
- Migrations directory excluded from linting: `exclude = ["db/migrations/versions"]`

**TypeScript Linting:**
- Tool: ESLint with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Config file: `frontend/eslint.config.mjs`
- TypeScript strict mode enabled in `frontend/tsconfig.json`

## Import Organization

**Python (enforced by ruff `I` rules):**
1. Standard library imports (`import uuid`, `from typing import ...`)
2. Third-party imports (`from sqlalchemy import ...`, `from fastapi import ...`)
3. Local imports (`from models.base import Base`, `from core.config import settings`)

**Example from `models/users.py`:**
```python
import uuid                                          # stdlib

from sqlalchemy import Boolean, DateTime, ...       # third-party
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from models.base import Base                        # local
```

**TypeScript:**
- Third-party imports first, then local imports with `@/` alias
- `@/*` maps to the frontend root (configured in `tsconfig.json`)

**Example from `components/ui/button.tsx`:**
```typescript
import { Button as ButtonPrimitive } from "@base-ui/react/button"  // third-party
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"                                    // local
```

**Path Aliases (TypeScript):**
- `@/*` → `./` (frontend root)

## SQLAlchemy Model Conventions

**Use modern `Mapped[]` annotation style (SQLAlchemy 2.0):**
```python
id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
name: Mapped[str] = mapped_column(String, nullable=False)
deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

**Column ordering within models:**
1. Primary key (`id`)
2. Foreign keys and identifying fields
3. Domain-specific fields
4. Status/flag fields (`is_active`, `is_published`)
5. Timestamps last (`created_at`, `updated_at`, `deleted_at`)

**Timestamps:**
- Always timezone-aware: `DateTime(timezone=True)`
- Server-side default: `server_default=func.now()`
- `onupdate` only on `updated_at`: `onupdate=func.now()`

**Soft deletes:**
- Pattern: `deleted_at: Mapped[DateTime | None]` (nullable column, not a boolean flag)

**Inline comments for constrained string enums:**
```python
profile_level: Mapped[str] = mapped_column(String, nullable=False)  # kid|student|engineer
role: Mapped[str] = mapped_column(String, nullable=False)  # owner|admin|member
```

**UUIDs:**
- All PKs use `UUID(as_uuid=True)` with `default=uuid.uuid4`
- FKs declared as `UUID(as_uuid=True)` with explicit `ForeignKey("table.id")`

**JSONB / ARRAY:**
- Use PostgreSQL-specific types from `sqlalchemy.dialects.postgresql`: `JSONB`, `ARRAY`, `UUID`
- Default JSONB to `{}` or `[]` via Python default (not `server_default`) for lists and dicts

## Configuration

**Pattern:** Pydantic `BaseSettings` with `.env` file loading:
```python
# core/config.py
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = ""
```
- Singleton exported as module-level `settings = Settings()`
- All consumers import `from core.config import settings`

## Seed Data

**Pattern:** Idempotent seed functions with early return:
```python
def seed_plans() -> None:
    db = SessionLocal()
    try:
        if db.query(Plan).count() > 0:
            print("Plans already seeded, skipping.")
            return
        db.add_all([...])
        db.commit()
    finally:
        db.close()
```
- Always wrap in `try/finally` to guarantee `db.close()`
- Guard clause at top prevents duplicate seeding
- `if __name__ == "__main__":` block for direct execution

## FastAPI Router Pattern

**Routers defined per domain module:**
```python
# api/health.py
from fastapi import APIRouter
router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok"}
```
- Router variable always named `router`
- Imported in `main.py` with alias: `from api.health import router as health_router`
- Registered via `app.include_router(health_router)`

## React Component Pattern (TypeScript)

**Named function components (not arrow functions):**
```typescript
function Button({ className, variant = "default", size = "default", ...props }) {
  return <ButtonPrimitive ... />
}
export { Button, buttonVariants }
```

**Tailwind + CVA pattern for variant components:**
```typescript
const buttonVariants = cva("<base-classes>", {
  variants: { variant: {...}, size: {...} },
  defaultVariants: { variant: "default", size: "default" },
})
```

**`cn()` utility for conditional class merging** (`lib/utils.ts`):
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## Error Handling

**Python — seed functions:** `try/finally` block guarantees cleanup, no explicit error catching (propagation is intentional).

**FastAPI:** No custom error handlers established yet; standard FastAPI exception propagation applies.

**TypeScript:** No error boundary or error handling patterns established yet (frontend is minimal scaffold).

## Module Exports

**Python models (`models/__init__.py`):** Explicit `__all__` list enumerating every exported symbol:
```python
from models.billing import Plan, Subscription, UsageEvent
__all__ = ["Base", "User", "Organization", ...]
```

**TypeScript components:** Named exports (not default):
```typescript
export { Button, buttonVariants }
```

## Comments

**When to use inline comments:**
- To document allowed enum values on constrained string columns: `# kid|student|engineer`
- Alembic auto-generated sections marked with `# ### commands auto generated by Alembic - please adjust! ###`

**No JSDoc/TSDoc:** Not currently used in the codebase.

**No dead code, no commented-out blocks** observed — consistent with project rules.

---

*Convention analysis: 2026-05-15*
