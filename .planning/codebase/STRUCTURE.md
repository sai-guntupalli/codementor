# Codebase Structure

**Analysis Date:** 2026-05-15

## Directory Layout

```
help_me_code/                     # Monorepo root
├── backend/                      # FastAPI Python backend
│   ├── api/                      # HTTP route handlers (one file per resource)
│   │   ├── __init__.py
│   │   └── health.py             # GET /health
│   ├── core/                     # App-wide utilities and config
│   │   ├── __init__.py
│   │   └── config.py             # pydantic-settings Settings class + singleton
│   ├── db/                       # Database access layer
│   │   ├── __init__.py
│   │   ├── session.py            # SQLAlchemy engine, SessionLocal, get_db()
│   │   └── migrations/           # Alembic migration environment
│   │       ├── env.py            # Alembic runner (online + offline modes)
│   │       └── versions/         # Generated migration scripts
│   │           └── 8b1d998d31f6_initial_schema.py
│   ├── models/                   # SQLAlchemy ORM models (13 tables)
│   │   ├── __init__.py           # Re-exports all models + Base
│   │   ├── base.py               # DeclarativeBase
│   │   ├── users.py              # User, Organization, OrgMember
│   │   ├── billing.py            # Plan, Subscription, UsageEvent
│   │   ├── learning.py           # Problem, Submission, SkillSnapshot
│   │   └── content.py            # ChatSession, CurriculumPath, Prompt, UserSetting
│   ├── seeds/                    # Idempotent seed scripts
│   │   ├── __init__.py
│   │   ├── plans.py              # Seeds Free + Pro plans
│   │   └── prompts.py            # Seeds 6 LLM prompt templates
│   ├── tests/                    # pytest test suite
│   │   ├── __init__.py
│   │   ├── conftest.py           # Fixtures: client (TestClient), db (Session)
│   │   ├── test_health.py        # API endpoint tests
│   │   └── test_db_connection.py # DB reachability + schema + seed tests
│   ├── main.py                   # FastAPI app entry point
│   ├── pyproject.toml            # Dependencies, ruff config, pytest config
│   ├── alembic.ini               # Alembic configuration
│   ├── Makefile                  # Backend-specific make targets
│   ├── .env.example              # Required env var template
│   └── .python-version           # Python version pin
├── frontend/                     # Next.js App Router frontend
│   ├── app/                      # Next.js App Router pages and layouts
│   │   ├── layout.tsx            # Root layout (fonts, html/body)
│   │   ├── page.tsx              # Home page (/)
│   │   ├── globals.css           # Tailwind v4 + shadcn CSS variables
│   │   └── favicon.ico
│   ├── components/               # Reusable React components
│   │   └── ui/                   # shadcn/ui primitives (base-nova style)
│   │       └── button.tsx        # Button with cva variants
│   ├── lib/                      # Shared frontend utilities
│   │   └── utils.ts              # cn() helper (clsx + tailwind-merge)
│   ├── public/                   # Static assets
│   ├── components.json           # shadcn/ui CLI config
│   ├── next.config.ts            # Next.js config
│   ├── package.json              # npm dependencies
│   ├── tsconfig.json             # TypeScript config
│   ├── postcss.config.mjs        # PostCSS config
│   ├── eslint.config.mjs         # ESLint config
│   ├── CLAUDE.md                 # Claude Code context (references AGENTS.md)
│   └── AGENTS.md                 # Next.js version warning for AI agents
├── docs/
│   └── superpowers/
│       ├── specs/                # Design and feature specifications
│       └── plans/                # Implementation plans
├── .planning/
│   └── codebase/                 # GSD codebase mapping documents
├── Makefile                      # Root-level orchestration targets
├── PROGRESS.md                   # Project progress tracker
└── README.md                     # Project documentation
```

## Directory Purposes

**`backend/api/`:**
- Purpose: FastAPI route handlers; one file per resource domain
- Contains: `APIRouter` instances, route functions, request/response models (schemas not yet added)
- Key files: `backend/api/health.py`
- Naming: snake_case filenames matching the resource noun (e.g., `problems.py`, `submissions.py`)

**`backend/core/`:**
- Purpose: Application-wide shared utilities — currently only config
- Contains: `Settings` class loaded from `.env`; exported as `settings` singleton
- Key files: `backend/core/config.py`

**`backend/db/`:**
- Purpose: Database connectivity and schema migration
- Contains: Session factory (`session.py`), Alembic environment (`migrations/env.py`), versioned migration scripts
- Key files: `backend/db/session.py`, `backend/db/migrations/env.py`

**`backend/models/`:**
- Purpose: All SQLAlchemy ORM table definitions, grouped by domain
- Contains: 13 models in 4 files; `base.py` holds `DeclarativeBase`; `__init__.py` re-exports everything
- Key files: `backend/models/__init__.py`, `backend/models/users.py`, `backend/models/billing.py`, `backend/models/learning.py`, `backend/models/content.py`

**`backend/seeds/`:**
- Purpose: Idempotent database seeding scripts; each file is independently runnable
- Contains: Plan seed (2 rows), prompt seed (6 rows)
- Key files: `backend/seeds/plans.py`, `backend/seeds/prompts.py`

**`backend/tests/`:**
- Purpose: pytest test suite covering API and database integration
- Contains: Shared fixtures in `conftest.py`, one test file per concern
- Key files: `backend/tests/conftest.py`, `backend/tests/test_health.py`, `backend/tests/test_db_connection.py`

**`frontend/app/`:**
- Purpose: Next.js App Router file-system routing — every file here maps to a URL
- Contains: Root `layout.tsx`, route `page.tsx` files, `globals.css`
- Key files: `frontend/app/layout.tsx`, `frontend/app/page.tsx`

**`frontend/components/ui/`:**
- Purpose: shadcn/ui component primitives, added via the shadcn CLI
- Contains: Styled wrappers over `@base-ui/react` primitives using `cva` variant patterns
- Key files: `frontend/components/ui/button.tsx`

**`frontend/lib/`:**
- Purpose: Shared frontend utility functions
- Contains: `cn()` for class merging; future API client helpers should be added here
- Key files: `frontend/lib/utils.ts`

## Key File Locations

**Entry Points:**
- `backend/main.py`: FastAPI app construction and Uvicorn target
- `frontend/app/layout.tsx`: Next.js root layout
- `frontend/app/page.tsx`: Home page (`/` route)

**Configuration:**
- `backend/core/config.py`: All runtime settings (`database_url`, `frontend_url`, `supabase_url`)
- `backend/.env.example`: Template for required environment variables
- `frontend/components.json`: shadcn/ui CLI configuration (style, aliases, icon library)
- `backend/alembic.ini`: Alembic migration configuration

**Core Logic:**
- `backend/db/session.py`: Database session factory and `get_db` dependency
- `backend/models/__init__.py`: Master export of all 13 ORM models
- `backend/db/migrations/versions/8b1d998d31f6_initial_schema.py`: Full initial schema migration

**Testing:**
- `backend/tests/conftest.py`: pytest fixtures (`client`, `db`)
- `backend/tests/test_health.py`: API health endpoint tests
- `backend/tests/test_db_connection.py`: DB connectivity and schema verification tests

## Naming Conventions

**Backend Python files:**
- Modules: `snake_case.py` (e.g., `health.py`, `session.py`, `config.py`)
- Model files: named after domain group, plural noun (e.g., `users.py`, `billing.py`, `learning.py`, `content.py`)
- Seed files: named after the entity being seeded (e.g., `plans.py`, `prompts.py`)
- Test files: `test_<subject>.py` prefix (e.g., `test_health.py`, `test_db_connection.py`)

**Backend Python symbols:**
- Classes (models, config): `PascalCase` (e.g., `User`, `OrgMember`, `Settings`)
- Functions and variables: `snake_case` (e.g., `get_db`, `seed_plans`, `session_local`)
- SQLAlchemy table names: `snake_case` plural (e.g., `"org_members"`, `"usage_events"`, `"skill_snapshots"`)
- Column names: `snake_case` (e.g., `owner_id`, `created_at`, `stripe_price_id`)

**Frontend files:**
- Page and layout files: `page.tsx`, `layout.tsx` (Next.js convention, lowercase)
- Component files: `PascalCase` noun (e.g., `button.tsx`) — shadcn/ui uses lowercase filenames but the exported symbol is `PascalCase`
- Utility files: `camelCase.ts` (e.g., `utils.ts`)

**Frontend TypeScript symbols:**
- Components: `PascalCase` functions (e.g., `Button`, `RootLayout`, `Home`)
- Utilities: `camelCase` functions (e.g., `cn`, `buttonVariants`)
- Path aliases: `@/` maps to `frontend/` root (e.g., `@/components/ui/button`, `@/lib/utils`)

## Where to Add New Code

**New API endpoint (backend):**
- Create `backend/api/<resource>.py` with a new `APIRouter`
- Mount it in `backend/main.py` with `app.include_router(router, prefix="/<resource>")`
- Add Pydantic request/response schemas to `backend/api/<resource>.py` or a dedicated `backend/schemas/<resource>.py`

**New database table:**
- Add model class to the appropriate domain file in `backend/models/` (or create a new file for a new domain)
- Export the new class from `backend/models/__init__.py`
- Run `alembic revision --autogenerate -m "description"` from `backend/`

**New frontend page:**
- Create `frontend/app/<route>/page.tsx` — file path = URL path (Next.js App Router)
- Nested layouts: add `frontend/app/<route>/layout.tsx`

**New UI component:**
- For shadcn/ui primitives: `npx shadcn@latest add <component>` (outputs to `frontend/components/ui/`)
- For custom components: `frontend/components/<Feature>.tsx` or `frontend/components/<feature>/index.tsx`

**New frontend utility / API client:**
- Shared helpers: `frontend/lib/<name>.ts`
- API client for backend: add to `frontend/lib/api.ts` (does not exist yet)

**New test:**
- Backend: add `backend/tests/test_<subject>.py`; share fixtures via `backend/tests/conftest.py`
- Frontend: no test framework configured yet

**New seed script:**
- Add `backend/seeds/<entity>.py` following the existing idempotency pattern (check count > 0, skip if already seeded)

## Special Directories

**`backend/.venv/`:**
- Purpose: Python virtual environment managed by `uv`
- Generated: Yes (via `uv sync`)
- Committed: No (git-ignored)

**`backend/db/migrations/versions/`:**
- Purpose: Alembic auto-generated migration scripts
- Generated: Yes (via `alembic revision --autogenerate`)
- Committed: Yes — migration history is source-controlled

**`frontend/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (via `npm run build` or `npm run dev`)
- Committed: No (git-ignored)

**`frontend/node_modules/`:**
- Purpose: npm dependency tree
- Generated: Yes (via `npm install`)
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Generated: Yes (by `/gsd:map-codebase`)
- Committed: Yes

**`docs/superpowers/`:**
- Purpose: Design specs and implementation plans produced by the GSD workflow
- Committed: Yes

---

*Structure analysis: 2026-05-15*
