# CodeMentor Phase 1: Project Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the complete monorepo structure for CodeMentor with a working FastAPI backend skeleton, Next.js frontend skeleton, Makefile, README, and PROGRESS.md — everything needed for all subsequent phases to build on.

**Architecture:** Monorepo with `frontend/` (Next.js 14 App Router) and `backend/` (FastAPI + uv + Python 3.12) as independently deployable services. No shared code between them — they communicate via REST/SSE. Each service is independently runnable via `make dev-frontend` / `make dev-backend`.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, FastAPI, uv, Python 3.12, Ruff (lint/format), Pytest, ESLint, Prettier

---

## File Map

**New files created in this phase:**

```
help_me_code/
├── Makefile                          # All project commands
├── README.md                         # Project overview + setup
├── PROGRESS.md                       # Living progress tracker
├── .gitignore                        # Root gitignore
│
├── backend/
│   ├── pyproject.toml                # uv project config + deps
│   ├── .python-version               # Pin to 3.12
│   ├── uv.lock                       # Lockfile (committed)
│   ├── Makefile                      # Backend-specific commands
│   ├── .env.example                  # Env var template
│   ├── main.py                       # FastAPI app entry point
│   ├── api/
│   │   ├── __init__.py
│   │   └── health.py                 # GET /health endpoint
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py                 # Settings via pydantic-settings
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py               # Pytest fixtures (TestClient)
│       └── test_health.py            # Health endpoint test
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── .env.example                  # Env var template
    ├── .eslintrc.json
    ├── components.json               # shadcn/ui config
    ├── app/
    │   ├── layout.tsx                # Root layout with font + theme
    │   ├── page.tsx                  # Landing/redirect page
    │   └── globals.css               # Tailwind base styles
    └── components/
        └── ui/                       # shadcn/ui components (auto-populated)
```

---

### Task 1: Create root gitignore and .env conventions

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create root `.gitignore`**

```
# Python
backend/.venv/
backend/__pycache__/
backend/**/__pycache__/
backend/**/*.pyc
backend/.pytest_cache/
backend/.ruff_cache/
backend/*.egg-info/

# Node
frontend/node_modules/
frontend/.next/
frontend/out/

# Env files
.env
.env.local
backend/.env
frontend/.env
frontend/.env.local

# OS
.DS_Store
*.swp
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add root gitignore"
```

---

### Task 2: Bootstrap FastAPI backend with uv

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.python-version`
- Create: `backend/main.py`
- Create: `backend/core/__init__.py`
- Create: `backend/core/config.py`
- Create: `backend/api/__init__.py`
- Create: `backend/api/health.py`

- [ ] **Step 1: Initialise uv project**

```bash
cd backend
uv init --name codementor-backend --python 3.12
```

This creates `pyproject.toml` and `.python-version`. Do NOT commit `uv.lock` yet — do that after adding deps.

- [ ] **Step 2: Add runtime dependencies**

```bash
cd backend
uv add fastapi "uvicorn[standard]" pydantic-settings python-dotenv
```

- [ ] **Step 3: Add dev dependencies**

```bash
cd backend
uv add --dev pytest httpx pytest-asyncio ruff
```

- [ ] **Step 4: Write `backend/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CodeMentor API"
    debug: bool = False
    frontend_url: str = "http://localhost:3000"


settings = Settings()
```

- [ ] **Step 5: Write `backend/api/health.py`**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Write `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from api.health import router as health_router

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
```

- [ ] **Step 7: Create `backend/.env.example`**

```
APP_NAME=CodeMentor API
DEBUG=false
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 8: Verify the app starts**

```bash
cd backend
uv run uvicorn main:app --reload --port 8000
```

Expected: `Application startup complete.` on stdout. Hit `Ctrl+C` to stop.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: bootstrap FastAPI backend with uv and Python 3.12"
```

---

### Task 3: Backend tests for the health endpoint

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
```

- [ ] **Step 2: Write the failing test in `backend/tests/test_health.py`**

```python
def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 3: Run test to verify it fails (before confirming the route works)**

```bash
cd backend
uv run pytest tests/test_health.py -v
```

Expected: PASS (it should already pass — if it FAILs, debug `main.py` router inclusion before continuing).

- [ ] **Step 4: Add ruff config to `backend/pyproject.toml`**

Append to `pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 5: Run ruff check**

```bash
cd backend
uv run ruff check .
uv run ruff format --check .
```

Expected: no errors. If there are format errors, run `uv run ruff format .` to auto-fix.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/ backend/pyproject.toml
git commit -m "test: add health endpoint test + ruff config"
```

---

### Task 4: Bootstrap Next.js frontend

**Files:**
- Create: `frontend/` (via `create-next-app`)

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/sai/WS/help_me_code
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=no \
  --import-alias="@/*" \
  --no-turbopack
```

Answer prompts:
- `Would you like to use Turbopack?` → No (already passed `--no-turbopack`)

- [ ] **Step 2: Verify Next.js boots**

```bash
cd frontend
npm run dev
```

Expected: `Ready in Xms` on port 3000. Open `http://localhost:3000` — Next.js default page should load. `Ctrl+C` to stop.

- [ ] **Step 3: Install shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Zinc**
- CSS variables: **Yes**

This creates `components.json`, updates `tailwind.config.ts`, and adds `app/globals.css` base styles.

- [ ] **Step 4: Add a test shadcn component to verify setup**

```bash
cd frontend
npx shadcn@latest add button
```

Expected: `components/ui/button.tsx` created.

- [ ] **Step 5: Replace `frontend/app/page.tsx` with a minimal landing page**

```tsx
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">
        CodeMentor
      </h1>
      <p className="mt-4 text-muted-foreground">
        Your adaptive coding learning platform.
      </p>
      <Button className="mt-8" size="lg">
        Get Started
      </Button>
    </main>
  );
}
```

- [ ] **Step 6: Replace `frontend/app/layout.tsx` with themed root layout**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CodeMentor",
  description: "Adaptive coding learning platform for Python and SQL",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create `frontend/.env.example`**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 8: Run lint + type check**

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: bootstrap Next.js 14 frontend with Tailwind and shadcn/ui"
```

---

### Task 5: Makefile

**Files:**
- Create: `Makefile` (root)
- Create: `backend/Makefile`

- [ ] **Step 1: Write `backend/Makefile`**

```makefile
.PHONY: install dev test lint format check

install:
	uv sync

dev:
	uv run uvicorn main:app --reload --port 8000

test:
	uv run pytest -v

lint:
	uv run ruff check .

format:
	uv run ruff format .

check: lint
	uv run ruff format --check .
	uv run pytest -v
```

- [ ] **Step 2: Write root `Makefile`**

```makefile
.PHONY: install dev dev-backend dev-frontend test lint format build help

install: ## Install all dependencies
	cd backend && uv sync
	cd frontend && npm install

dev-backend: ## Start backend dev server (port 8000)
	cd backend && uv run uvicorn main:app --reload --port 8000

dev-frontend: ## Start frontend dev server (port 3000)
	cd frontend && npm run dev

test: ## Run all tests
	cd backend && uv run pytest -v

lint: ## Lint all code
	cd backend && uv run ruff check .
	cd frontend && npm run lint

format: ## Auto-format all code
	cd backend && uv run ruff format .

build: ## Build frontend for production
	cd frontend && npm run build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
```

- [ ] **Step 3: Verify make commands work**

```bash
make help
```

Expected: formatted table of commands with descriptions.

```bash
make test
```

Expected: pytest runs and health test passes.

- [ ] **Step 4: Commit**

```bash
git add Makefile backend/Makefile
git commit -m "chore: add root and backend Makefile with standard targets"
```

---

### Task 6: PROGRESS.md and README.md

**Files:**
- Create: `PROGRESS.md`
- Create: `README.md`

- [ ] **Step 1: Write `PROGRESS.md`**

```markdown
# CodeMentor — Progress

## Current Status
Phase 1 (Project Scaffold) complete. Backend and frontend skeletons are running. Ready to start Phase 2: Database Schema.

## Completed
- [2026-05-15] Design spec approved (`docs/superpowers/specs/2026-05-15-codementor-design.md`)
- [2026-05-15] Phase 1: Project scaffold — FastAPI backend, Next.js frontend, Makefile, README

## In Progress
- Phase 2: Database Schema (Supabase + 13-table migration)

## Next Steps
1. Set up Supabase project (get `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`)
2. Create branch `feat/database-schema`
3. Write Alembic migration for all 13 tables from the design spec
4. Seed the `problems` table with 10 curated Python problems and 5 SQL problems
5. Write the `prompts` table seed with all 6 prompt templates from the spec
6. Open PR → merge → move to Phase 3 (Backend Core)

## Blockers
- None
```

- [ ] **Step 2: Write `README.md`**

```markdown
# CodeMentor

An adaptive coding learning platform for Python and SQL. Users solve problems in a browser IDE, get LLM-powered code review, progressive hints, and interactive explanations. Skill tracking adapts problem recommendations over time.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12, uv |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| LLM | OpenRouter (any model) |
| Editor | Monaco Editor |

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Install

```bash
make install
```

### Run (two terminals)

```bash
# Terminal 1 — backend
make dev-backend

# Terminal 2 — frontend
make dev-frontend
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

### Environment Variables

Copy the example files and fill in values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

## Commands

```bash
make install        # Install all dependencies
make dev-backend    # Start FastAPI server (port 8000)
make dev-frontend   # Start Next.js server (port 3000)
make test           # Run backend tests
make lint           # Lint all code
make format         # Auto-format all code
make build          # Build frontend for production
make help           # Show all commands
```

## Project Structure

```
help_me_code/
├── backend/         # FastAPI application
├── frontend/        # Next.js application
├── docs/            # Design specs and implementation plans
├── Makefile         # Project commands
├── PROGRESS.md      # Current status and next steps
└── README.md        # This file
```

## Design

See [`docs/superpowers/specs/2026-05-15-codementor-design.md`](docs/superpowers/specs/2026-05-15-codementor-design.md) for the full design spec.

## Progress

See [`PROGRESS.md`](PROGRESS.md) for current status and next steps.
```

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md README.md
git commit -m "docs: add README and PROGRESS.md for Phase 1"
```

---

### Task 7: Final verification and PR

- [ ] **Step 1: Run full check from root**

```bash
make install
make test
make lint
make build
```

Expected: all pass with no errors.

- [ ] **Step 2: Verify backend health endpoint manually**

```bash
# In one terminal:
make dev-backend

# In another:
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/project-scaffold
```

Then open a PR titled: `feat: Phase 1 — project scaffold (FastAPI + Next.js + Makefile)`

PR description should note:
- Sets up the full monorepo structure
- Backend: FastAPI + uv + Python 3.12, health endpoint, ruff, pytest
- Frontend: Next.js 14 + TypeScript + Tailwind + shadcn/ui
- Makefile with install/dev/test/lint/format/build targets
- PROGRESS.md and README.md

- [ ] **Step 4: Prompt user to review and merge the PR before starting Phase 2**
