# Architecture

**Analysis Date:** 2026-05-15

## Pattern Overview

**Overall:** Monorepo with a decoupled client-server architecture. The backend is a layered FastAPI application (routes → db session → models); the frontend is a Next.js App Router SPA. The two communicate over HTTP with CORS configured. The database is Supabase-hosted PostgreSQL managed via SQLAlchemy + Alembic.

**Key Characteristics:**
- Hard separation between `backend/` and `frontend/` — no shared code
- Backend layers: `api/` (routers) → `db/` (session factory) → `models/` (ORM)
- Frontend is early-stage: App Router scaffold, shadcn/ui component system, no API client yet
- Schema-first approach: all 13 tables defined in SQLAlchemy models before any API routes are built
- Configuration is centralised in `backend/core/config.py` via `pydantic-settings`

## Layers

**API Layer:**
- Purpose: HTTP request handling, routing, response shaping
- Location: `backend/api/`
- Contains: FastAPI `APIRouter` modules, one file per resource group
- Depends on: `db/session.py` (via `get_db` dependency injection), `models/`
- Used by: `backend/main.py` which mounts all routers

**Application Entry Point:**
- Purpose: FastAPI app construction, middleware registration, router mounting
- Location: `backend/main.py`
- Contains: `app = FastAPI(...)`, CORS middleware, `app.include_router(...)` calls
- Depends on: `api/`, `core/config.py`
- Used by: Uvicorn (`uvicorn main:app`)

**Core / Config Layer:**
- Purpose: Centralised settings loaded from environment
- Location: `backend/core/config.py`
- Contains: `Settings(BaseSettings)` singleton exported as `settings`
- Depends on: `.env` file (loaded automatically by pydantic-settings)
- Used by: `main.py`, `db/session.py`, `db/migrations/env.py`

**Database Session Layer:**
- Purpose: SQLAlchemy engine and session factory; FastAPI dependency provider
- Location: `backend/db/session.py`
- Contains: `engine`, `SessionLocal`, `get_db()` generator
- Depends on: `core/config.py` for `DATABASE_URL`
- Used by: API route handlers (injected via `Depends(get_db)`)

**ORM Models Layer:**
- Purpose: Declarative SQLAlchemy table definitions grouped by domain
- Location: `backend/models/`
- Contains: 13 models across 4 domain files; `Base` declared in `models/base.py`; all re-exported from `models/__init__.py`
- Depends on: `models/base.py`
- Used by: `db/migrations/env.py` (autogenerate), API layer, seeds, tests

**Migrations Layer:**
- Purpose: Schema version control via Alembic
- Location: `backend/db/migrations/`
- Contains: `env.py` (migration runner), `versions/` (one migration file per revision)
- Depends on: `models/` (imports `Base.metadata` for autogenerate), `core/config.py`
- Used by: `alembic upgrade head` CLI command

**Seeds Layer:**
- Purpose: Idempotent initial data population (plans, prompts)
- Location: `backend/seeds/`
- Contains: `plans.py`, `prompts.py` — each runnable as `__main__`
- Depends on: `db/session.py`, `models/`
- Used by: Manually invoked; not wired into startup

**Frontend Application:**
- Purpose: Next.js App Router UI
- Location: `frontend/app/`
- Contains: `layout.tsx` (root layout, font loading), `page.tsx` (home page), `globals.css` (Tailwind + shadcn CSS variables)
- Depends on: `components/ui/`, `lib/utils.ts`
- Used by: Next.js runtime

**UI Component Layer:**
- Purpose: Reusable, styled UI primitives (shadcn/ui "base-nova" style)
- Location: `frontend/components/ui/`
- Contains: `button.tsx` (wraps `@base-ui/react/button` with `cva` variants)
- Depends on: `@base-ui/react`, `class-variance-authority`, `@/lib/utils`
- Used by: Any page or feature component

## Data Flow

**Inbound API Request:**
1. HTTP request hits Uvicorn
2. FastAPI matches route to a handler in `backend/api/<resource>.py`
3. Handler receives `db: Session` via `Depends(get_db)` from `backend/db/session.py`
4. Handler queries/writes using SQLAlchemy ORM models from `backend/models/`
5. Handler returns a Pydantic response model (schemas not yet created — Phase 3)
6. FastAPI serialises to JSON; CORS headers applied by middleware

**Schema Migration:**
1. Developer modifies a model in `backend/models/`
2. `alembic revision --autogenerate` reads `Base.metadata` via `db/migrations/env.py`
3. Generated file placed in `backend/db/migrations/versions/`
4. `alembic upgrade head` applies migration to Supabase PostgreSQL

**Seed Data:**
1. Developer runs `uv run python seeds/plans.py` (or `seeds/prompts.py`) from `backend/`
2. Script opens a `SessionLocal` session, checks for existing rows, inserts if empty, commits

**Frontend → Backend (planned):**
1. Browser loads Next.js app at `http://localhost:3000`
2. React component calls backend at `http://localhost:8000` (CORS allows this)
3. No API client abstraction exists yet — will live in `frontend/lib/`

**State Management:**
- Backend: stateless per-request; all state in PostgreSQL
- Frontend: no state management library yet; React local state only

## Key Abstractions

**`Settings` (pydantic-settings):**
- Purpose: Single source of truth for all runtime config
- Location: `backend/core/config.py`
- Pattern: `settings` singleton imported directly by all modules that need config

**`Base` (SQLAlchemy `DeclarativeBase`):**
- Purpose: Shared ORM base class; `Base.metadata` drives Alembic autogenerate
- Location: `backend/models/base.py`
- Pattern: All model classes inherit from `Base`; all exported through `backend/models/__init__.py`

**`get_db` (FastAPI dependency):**
- Purpose: Per-request database session with guaranteed cleanup
- Location: `backend/db/session.py`
- Pattern: `yield`-based generator; used as `db: Session = Depends(get_db)` in route handlers

**`buttonVariants` (cva):**
- Purpose: Type-safe variant system for the Button UI primitive
- Location: `frontend/components/ui/button.tsx`
- Pattern: `cva(baseClasses, { variants: {...} })`; wraps `@base-ui/react/button`

**`cn` utility:**
- Purpose: Merge Tailwind class strings safely
- Location: `frontend/lib/utils.ts`
- Pattern: `cn(...inputs)` — thin wrapper over `clsx` + `tailwind-merge`

## Entry Points

**Backend HTTP server:**
- Location: `backend/main.py`
- Triggers: `uvicorn main:app --reload --port 8000` (via `make dev-backend`)
- Responsibilities: App construction, CORS, router mounting

**Alembic CLI:**
- Location: `backend/alembic.ini` + `backend/db/migrations/env.py`
- Triggers: `alembic upgrade head` run from `backend/`
- Responsibilities: Apply pending migrations to the target database

**Frontend dev server:**
- Location: `frontend/app/` (Next.js App Router)
- Triggers: `npm run dev` / `make dev-frontend` (port 3000)
- Responsibilities: Serves the React UI; proxying to backend not yet configured

## Error Handling

**Strategy:** Minimal / default at this stage. FastAPI's default exception handlers are active. No custom error middleware or structured error responses implemented yet.

**Patterns:**
- `get_db()` uses `try/finally` to guarantee session close on any outcome
- Seed scripts use `try/finally` to close the session regardless of success/failure
- No `HTTPException` wrappers or global error handlers in `main.py` yet

## Cross-Cutting Concerns

**Logging:** Not configured. No logging calls in any source file. FastAPI/Uvicorn default access logs only.

**Validation:** Pydantic v2 via FastAPI for request parsing. Input schemas (request bodies) not yet defined — Phase 3 will add them. Model-level column constraints enforced by SQLAlchemy (nullable, unique, defaults).

**Authentication:** Not implemented. `User.is_admin` flag and `supabase_url`/`supabase_key` settings are present, indicating Supabase Auth is the planned provider (Phase 4).

**CORS:** Configured in `backend/main.py` — single allowed origin from `settings.frontend_url` (`http://localhost:3000` default).

---

*Architecture analysis: 2026-05-15*
