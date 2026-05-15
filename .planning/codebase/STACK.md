# Technology Stack

**Analysis Date:** 2026-05-15

## Languages

**Primary:**
- Python 3.12 - Backend API, models, migrations (`backend/`)
- TypeScript 5.x - Frontend application (`frontend/`)

**Secondary:**
- SQL (PostgreSQL dialect) - Schema migrations via Alembic (`backend/db/migrations/`)

## Runtime

**Backend Environment:**
- Python 3.12.12 (managed via `uv`)
- Virtual environment: `backend/.venv/`

**Frontend Environment:**
- Node.js v24.13.1
- Package manager: `npm` (lockfile: `frontend/package-lock.json`)

**Package Manager (backend):**
- `uv` 0.9.16
- Lockfile: `backend/uv.lock` (present and committed)

## Frameworks

**Backend Core:**
- FastAPI 0.136.1+ - REST API framework (`backend/main.py`)
- Uvicorn 0.47.0+ (standard extras) - ASGI server, used with `--reload` in dev

**Frontend Core:**
- Next.js 16.2.6 - React framework (App Router, `frontend/app/`)
- React 19.2.4 - UI library
- React DOM 19.2.4

**Database ORM / Migrations:**
- SQLAlchemy 2.0.49+ - ORM with Mapped/mapped_column typed API (`backend/models/`)
- Alembic 1.18.4+ - Schema migrations (`backend/db/migrations/`, config at `backend/alembic.ini`)

**Settings / Config:**
- pydantic-settings 2.14.1+ - Typed settings loaded from `.env` (`backend/core/config.py`)
- python-dotenv 1.2.2+ - `.env` file loading

**Testing (backend):**
- pytest 9.0.3+ - Test runner
- pytest-asyncio 1.3.0+ - Async test support
- httpx 0.28.1+ - HTTP client for API testing

**Linting / Formatting:**
- ruff 0.15.13 - Python linter and formatter (line-length=100, targets py312, rules: E, F, I)
- Config: `backend/pyproject.toml` `[tool.ruff]` section

**Frontend Styling:**
- Tailwind CSS 4.x - Utility-first CSS
- `@tailwindcss/postcss` 4.x - PostCSS integration (`frontend/postcss.config.mjs`)
- tailwind-merge 3.6.0 - Conditional class merging
- tw-animate-css 1.4.0 - Animation utilities

**Frontend UI:**
- shadcn 4.7.0 - Component library (copies components into project)
- `@base-ui/react` 1.4.1 - Accessible primitives (Base UI)
- class-variance-authority 0.7.1 - CVA for variant-driven component APIs
- clsx 2.1.1 - Conditional class names
- lucide-react 1.16.0 - Icon set

**Frontend Linting:**
- ESLint 9.x - Linting
- eslint-config-next 16.2.6 - Next.js rules (core-web-vitals + typescript presets)
- Config: `frontend/eslint.config.mjs`

## Key Dependencies

**Critical (backend):**
- `supabase>=2.30.0` - Supabase client SDK for auth and storage (`backend/pyproject.toml`)
- `psycopg2-binary>=2.9.12` - PostgreSQL driver (direct SQLAlchemy connection)
- `sqlalchemy>=2.0.49` - ORM (typed mapped columns, UUID/JSONB/ARRAY PostgreSQL types)
- `fastapi>=0.136.1` - API framework with automatic OpenAPI docs

**Critical (frontend):**
- `next 16.2.6` - Full-stack React framework (App Router)
- `shadcn ^4.7.0` - Component scaffold CLI/library
- `lucide-react ^1.16.0` - Icons

## Configuration

**Environment (backend):**
- Settings class: `backend/core/config.py` (pydantic-settings)
- Loaded from: `backend/.env` file
- Required vars: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`
- Optional vars: `APP_NAME`, `DEBUG`, `FRONTEND_URL`
- Example: `backend/.env.example`

**Build:**
- Backend: no build step; `uv run uvicorn main:app` to start
- Frontend: `next build` → output in `frontend/.next/`
- TypeScript: `frontend/tsconfig.json` (strict mode, `@/*` path alias mapping to `frontend/*`)

**Alembic:**
- Config: `backend/alembic.ini`
- Migrations script location: `backend/db/migrations/`
- Database URL sourced dynamically from `core.config.settings` via `env.py`
- Ruff excluded from migrations: `db/migrations/versions`

## Platform Requirements

**Development:**
- Python 3.12+
- Node.js 24+ (based on installed version)
- `uv` for backend dependency/env management
- PostgreSQL database (Supabase-hosted)

**Production:**
- PostgreSQL via Supabase connection pooler (`aws-0-us-west-2.pooler.supabase.com:5432`)
- Backend: ASGI-compatible host (e.g., Railway, Render, Fly.io — not specified in repo)
- Frontend: Next.js-compatible host (Vercel assumed, not specified in repo)

## Build & Dev Commands

All common commands are in the root `Makefile`:

```bash
make install        # uv sync (backend) + npm install (frontend)
make dev-backend    # uvicorn main:app --reload --port 8000
make dev-frontend   # next dev (port 3000)
make test           # pytest -v (backend only)
make lint           # ruff check + eslint
make format         # ruff format (backend)
make build          # next build (frontend)
```

---

*Stack analysis: 2026-05-15*
