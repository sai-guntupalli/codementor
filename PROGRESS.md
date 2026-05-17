# CodeMentor — Progress

## Current Status
Phase 6 complete: skill assessment runs after every code review, XP is awarded, skill levels tracked per topic, and the dashboard shows live stats.

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
- [2026-05-17] Phase 6: Skill assessment
  - `llm/skill.py` — deterministic scoring from review verdict, per-topic skill update, XP award
  - `assess_submission()` called after every review, updates `user.skill_level` + `user.xp_total` + creates `SkillSnapshot`
  - `xp_earned` + `score` included in SSE `done` event
  - Frontend shows "+N XP earned" badge in AI panel after review
  - `GET /users/me/skills` endpoint returns `skill_level`, `xp_total`, `streak_days`
  - Dashboard shows XP, streak, skill count, and per-topic progress bars
  - 34 tests passing

## In Progress
- Nothing — ready for Phase 7

## Next Steps
1. Phase 7: Remaining screens
   - `/profile` — editable display_name, profile_level, view full skill breakdown
   - `/progress` — submission history, skill growth charts over time
2. Add more seeded problems (variety of topics for skill tracking)
3. Open PR for review

## Blockers
- None
