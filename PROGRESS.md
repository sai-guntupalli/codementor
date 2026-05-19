# CodeMentor — Progress

## Current Status
Onboarding wizard live — new users answer 4 proficiency questions and receive a personalized learning path on signup.

## Completed
- [2026-05-15] Design spec approved (`docs/superpowers/specs/2026-05-15-codementor-design.md`)
- [2026-05-15] Phase 1: Project scaffold — FastAPI backend, Next.js frontend, Makefile, README
- [2026-05-15] Phase 2: Database schema
  - SQLAlchemy models for all 13 tables (4 groups: identity, billing, learning, content)
  - Alembic migration applied to Supabase PostgreSQL 17
  - Seeded: 2 plans (Free, Pro), 6 prompt templates
  - 5 tests passing (health + DB connectivity + schema + seed verification)
- [2026-05-15] Phase 3: Backend Core API
  - Pydantic schemas (`schemas/`), JWT auth (`core/deps.py`), Supabase auth router
  - `GET /problems`, `GET /problems/{id}`, `GET /curriculum-paths`, `GET /curriculum-paths/{id}`
  - `GET /users/me`, `PATCH /users/me`, `POST /submissions`
  - 21 tests passing (3 auth stubs skipped for Supabase integration)
- [2026-05-15] Phase 3: Frontend auth (Plan 03-03)
  - Supabase SSR clients, `proxy.ts` route protection, login/signup/profile-setup pages
  - Dashboard with logout; signup syncs local user via `POST /auth/signup`
- [2026-05-15] Phase 4: LLM abstraction layer
  - `llm/registry.py` — DB prompts + variable rendering
  - `llm/router.py` — plan-gated model selection (`config/models.yaml`)
  - `POST /llm/stream` — SSE passthrough to OpenRouter
  - `usage_events` logging per stream
  - 27 tests passing
- [2026-05-15] Phase 5: Practice flow + Three-panel IDE
  - `POST /submissions/{id}/review` — streaming code review, saves `llm_review`
  - Sample problem seed (`python -m seeds.problems`)
  - Frontend `/problems` list + `/practice/[id]` submit & stream UI
  - Backend: `POST /problems/{id}/hint|solution|teach|chat`, `POST /problems/surprise-me`
  - Frontend: Monaco editor, problem sidebar, AI panel tabs (Review, Hints, Solution, Teach, Chat)
  - Markdown rendering for all AI output; Surprise Me navigates to new problem
  - 29 tests passing
- [2026-05-17] Phase 5 polish
  - Syntax highlighting in code blocks (react-syntax-highlighter + custom dark theme)
  - Mobile AI panel: 50vh capped container with scroll
  - Sidebar collapse UX already implemented
- [2026-05-16] UI polish: problems list + practice page
  - Problems page: language/difficulty filter pills, topic search, pagination, problem count, skeleton loading
  - Practice page: examples and constraints rendered in problem panel
  - AI panel: loading spinner on all tabs while streaming; empty-code guard on Teach (shows error instead of calling LLM)
- [2026-05-17] Phase 6: Skill assessment
  - `llm/skill.py` — deterministic scoring from review verdict, per-topic skill update, XP award
  - `assess_submission()` called after every review, updates `user.skill_level` + `user.xp_total` + creates `SkillSnapshot`
  - `xp_earned` + `score` included in SSE `done` event
  - Frontend shows "+N XP earned" badge in AI panel after review
  - `GET /users/me/skills` endpoint returns `skill_level`, `xp_total`, `streak_days`
  - Dashboard shows XP, streak, skill count, and per-topic progress bars
  - 34 tests passing
- [2026-05-18] Landing page
  - Public SaaS landing page at `/` with hero, features, how-it-works, pricing, footer
  - Auto-redirects logged-in users to `/dashboard`
- [2026-05-18] Phase 7: Remaining screens
  - `GET /submissions/me` endpoint with `SubmissionHistoryItem` schema — 43 tests passing
  - `AppShell` shared sidebar nav (Dashboard, Problems, Learn, Progress, Settings)
  - `next-themes` ThemeProvider + Input component
  - `/dashboard` — enhanced with AppShell, recommended problems, recent activity
  - `/problems` — wrapped with AppShell sidebar
  - `/learn` (SCR-02) — curriculum paths list with empty state
  - `/progress` (SCR-03) — stats, skill breakdown, submission history table
  - `/settings` (SCR-04) — profile form + theme toggle

- [2026-05-18] Phase 8: Python code execution via Piston
  - `POST /execute` proxies to emkc.org Piston API; enforces 32KB code limit and 10s timeout
  - Python only (SQL skipped — no PostgreSQL runtime in Piston)
  - Frontend: "Run" button in practice IDE header; OutputPanel shows stdout (green), stderr (red), timeout warning
  - 5 new tests (auth, sql rejection, size limit, success mock, timeout mock); all passing

- [2026-05-18] Docker setup
  - `backend/Dockerfile` — Python 3.12 + uv, layer-cached deps, uvicorn entrypoint
  - `frontend/Dockerfile` — multi-stage Next.js standalone build (node:22-alpine)
  - `docker-compose.yml` — backend + frontend + piston wired on internal network
  - `next.config.ts` — `output: "standalone"` for minimal production image
  - Makefile: `make docker-up`, `docker-down`, `docker-build`, `docker-logs`, `docker-restart`
  - Root `.env.example` documents all required variables

- [2026-05-18] Bulk problem enrichment
  - `backend/seeds/enrich_problems.py` — sends all problems to Claude Haiku via OpenRouter
  - Reassigned difficulty based on common-user week-of-learning scale (beginner/easy/medium/hard)
  - Added 2–5 semantic tags per problem from taxonomy: strings, arrays, math, loops, functions, hash-map, binary-tree, graph, dynamic-programming, etc.
  - 186 difficulty changes, 111 title fixes, 227 description fixes applied
  - `make enrich-problems` / `make apply-enrichment` targets added
  - 397 problems: 76 beginner, 153 easy, 124 medium, 44 hard — 48 tests passing

- [2026-05-18] OSS problem ingestion pipeline
  - Alembic migration adds `sort_order INTEGER` to `problems` table; backfills LeetCode problems to `1000 + external_id`
  - `backend/seeds/scrapers/curated.py` — 25 hand-written absolute-beginner problems (sort 1–25)
  - `backend/seeds/scrapers/four_geeks.py` — 4GeeksAcademy repos (sort 100–280, ~126 problems)
  - `backend/seeds/scrapers/exercism.py` — exercism/python difficulty ≤ 5 (sort 300–800, ~126 problems)
  - `backend/seeds/ingest_oss.py` — dedup pipeline (slug + fuzzy-title), writes `oss_problems.json`
  - `make scrape-oss` / `make insert-oss` targets added
  - Problems list API now orders by `sort_order ASC NULLS LAST`
  - 262 new problems inserted → 395 total; 48 tests passing

- [2026-05-18] Onboarding proficiency wizard
  - `/profile/setup` rewritten as 5-step wizard: name/role → experience → goal → topics → learning path reveal
  - 4 new `User` columns: `coding_experience`, `learning_goal`, `interested_topics` + Alembic migration
  - `GET /users/me/learning-path` returns 12 curated problems based on experience, goal, and topic preferences
  - Step indicator dots, animated progress bar, icon cards, multi-select topic chips
  - 48 tests passing

## In Progress
- Nothing — ready for next milestone

## Next Steps
1. Stripe billing integration — Free/Pro plan enforcement, checkout flow, webhook handling
2. Problem set expansion — seed 50+ Python and SQL problems across difficulty levels
3. Deploy to production — push Docker images to a registry, deploy to Fly.io / Railway
4. Open PR for review

## Blockers
- None
