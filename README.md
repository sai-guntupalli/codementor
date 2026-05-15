# CodeMentor

An adaptive coding learning platform for Python and SQL. Users solve problems in a browser IDE, get LLM-powered code review, progressive hints, and interactive explanations. Skill tracking adapts problem recommendations over time.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12, uv |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| LLM | OpenRouter (model-agnostic) |
| Editor | Monaco Editor |

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) — `curl -LsSf https://astral.sh/uv/install.sh | sh`

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

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

### Environment Variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit each file with your actual values (Supabase, OpenRouter keys).

## Commands

```bash
make install        # Install all dependencies
make dev-backend    # Start FastAPI dev server (port 8000)
make dev-frontend   # Start Next.js dev server (port 3000)
make test           # Run backend tests
make lint           # Lint all code
make format         # Auto-format all code
make build          # Build frontend for production
make help           # Show all commands
```

## Project Structure

```
help_me_code/
├── backend/         # FastAPI application (Python 3.12 + uv)
│   ├── api/         # Route handlers
│   ├── core/        # Config, shared utilities
│   ├── tests/       # Pytest tests
│   └── main.py      # App entry point
├── frontend/        # Next.js 14 application
│   ├── app/         # App Router pages and layouts
│   ├── components/  # React components (shadcn/ui in components/ui/)
│   └── lib/         # Utilities
├── docs/
│   └── superpowers/
│       ├── specs/   # Design specifications
│       └── plans/   # Implementation plans
├── Makefile         # Project commands
├── PROGRESS.md      # Current status and next steps
└── README.md        # This file
```

## Design & Progress

- Full design spec: [`docs/superpowers/specs/2026-05-15-codementor-design.md`](docs/superpowers/specs/2026-05-15-codementor-design.md)
- Current status: [`PROGRESS.md`](PROGRESS.md)
