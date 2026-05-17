# CodeMentor

## What This Is

An AI-powered coding learning platform where users practice programming problems and receive real-time LLM feedback: code review with an improved version, progressive hints, solutions at configurable depth, and an interactive "Teach Me" chat mode that explains code line-by-line. Skill level is tracked adaptively after each submission so the platform gets smarter about what to surface next.

## Core Value

Users write code, submit, and instantly learn — the LLM reviews it, shows a better version, and teaches why, all in one flow.

## Requirements

### Validated

- ✓ Project scaffold (FastAPI backend, Next.js frontend, Makefile, README, Supabase connection) — Phase 1
- ✓ Full database schema deployed to Supabase PostgreSQL 17 (13 tables: users, organizations, org_members, plans, subscriptions, usage_events, problems, submissions, skill_snapshots, chat_sessions, curriculum_paths, prompts, user_settings) — Phase 2
- ✓ Seed data: 2 plans (Free, Pro), 6 prompt templates — Phase 2

### Active

- [ ] Backend REST API: problems CRUD, submissions, user profile
- [ ] Auth: Supabase JWT middleware, protected endpoints, profile setup
- [ ] LLM abstraction layer: prompt registry, model router (OpenRouter), SSE streaming
- [ ] Code review flow: submit code → stream LLM review → return improved version + score
- [ ] Hint system: progressive hints (1, 2, 3) per problem per user
- [ ] Solution view: configurable depth (beginner/intermediate/advanced)
- [ ] Teach Me: line-by-line explanation streamed via SSE
- [ ] Interactive AI chat: freeform conversation anchored to a problem/submission
- [ ] Surprise Me: LLM-generated problem tailored to user's current skill level
- [ ] Skill tracker: async skill assessment after each submission
- [ ] Frontend: three-panel IDE layout (problem list | Monaco editor | AI assistant)
- [ ] Dashboard: skill summary, streak, XP, recommended problems
- [ ] Learn: curriculum paths (Python track, SQL track)
- [ ] Progress: skill history, submission history, weak area identification
- [ ] User-selectable LLM model (gated by subscription plan)

### Out of Scope

- Code execution / sandboxing — too complex for v1, LLM reviews static code only
- Real-time multiplayer / pair coding — deferred
- Mobile native app — web-first
- Video content — not a core learning mode
- OAuth login — email/password sufficient for v1

## Context

- **Tech stack**: FastAPI (Python 3.12, uv, SQLAlchemy 2.0, Alembic), Next.js 14 (TypeScript, Tailwind, shadcn/ui), Supabase (PostgreSQL 17, auth, RLS), OpenRouter (multi-model LLM access via one API key), Monaco editor for code input.
- **LLM model routing**: config-driven via `models.yaml`. Default: `anthropic/claude-sonnet-4-5`. Free tier gets Claude Haiku + Llama. Pro gets full model selection.
- **Streaming**: all LLM responses stream via SSE (Server-Sent Events) — FastAPI passes through OpenRouter stream to Next.js which renders tokens live.
- **Prompt registry**: 6 prompt templates stored in DB (code_review, hint_generator, solution_generator, teach_me, surprise_me, skill_assessor). Versioned so prompts can be tuned without redeploying.
- **SaaS-ready**: orgs, seats, subscriptions, usage_events tracking already in schema. Won't block solo-user v1 flow.
- **Design**: three-panel layout (left: problem list/nav, center: Monaco editor, right: AI assistant panel). Recommended from brainstorm.
- **Branch naming**: feat/ for features, fix/ for bugs. Current branch: feat/database-schema.

## Constraints

- **Tech stack**: FastAPI + Next.js + Supabase — already committed, not changing
- **LLM access**: OpenRouter only — provides model flexibility without managing multiple API keys
- **Python**: 3.12+, uv, pyproject.toml — already set up
- **No code execution**: LLM reviews static code; no sandbox needed for v1
- **DB**: Supabase PostgreSQL — RLS must be configured for all user-data tables

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Clean separation (Next.js frontend / FastAPI backend) | LLM layer best in Python; independent scaling; SaaS-ready from day 1 | — Pending |
| OpenRouter for LLM access | Single API key, model switching, cost transparency | — Pending |
| Prompt templates in DB | Tune prompts without redeployment; versioning enables A/B testing | — Pending |
| SSE for streaming | Native browser support, no WebSocket complexity for one-directional streams | — Pending |
| SaaS schema from day 1 | Retrofitting billing/orgs is painful; additive design doesn't hurt v1 | — Pending |
| Three-panel IDE layout | Keeps problem, editor, and AI always visible — matches real IDE + tutor mental model | — Pending |

---
*Last updated: 2026-05-15 after initialization (brownfield — Phases 1 & 2 complete)*
