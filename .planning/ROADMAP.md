# Roadmap: CodeMentor

## Overview

CodeMentor ships in 7 phases. Phases 1 and 2 are complete (scaffold + DB schema). The remaining 5 phases build the backend API and auth layer, then the LLM abstraction engine, then the core AI practice experience, then adaptive skill tracking, and finally the full frontend with all four standalone screens. Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Scaffold** - FastAPI + Next.js project structure, Makefile, Supabase connection
- [x] **Phase 2: Database Schema** - All 13 tables deployed, seed data (plans + prompts)
- [ ] **Phase 3: Backend Core** - REST endpoints (problems, submissions, user profile, curriculum) + auth middleware + profile setup flow
- [ ] **Phase 4: LLM Abstraction Layer** - Prompt registry, model router, SSE streaming, usage logging
- [ ] **Phase 5: Practice Flow** - Three-panel IDE, code review, hints, solutions, Teach Me, AI chat, Surprise Me
- [ ] **Phase 6: Skill Tracking + Custom Problems** - Async skill assessment, skill snapshots, user-created problems
- [ ] **Phase 7: Frontend Screens** - Dashboard, Learn (curriculum), Progress, Settings

## Phase Details

### Phase 1: Scaffold
**Goal**: Project infrastructure exists and both services can run locally
**Depends on**: Nothing
**Requirements**: (pre-roadmap, validated)
**Success Criteria** (what must be TRUE):
  1. `make dev` starts both FastAPI and Next.js without errors
  2. FastAPI health endpoint returns 200
  3. Next.js connects to Supabase without errors
  4. Makefile has install, dev, test, build, lint, format targets
**Plans**: Complete

### Phase 2: Database Schema
**Goal**: Full production schema is deployed and verified in Supabase
**Depends on**: Phase 1
**Requirements**: (pre-roadmap, validated)
**Success Criteria** (what must be TRUE):
  1. All 13 tables exist in Supabase PostgreSQL 17
  2. Alembic migration runs cleanly from scratch
  3. Seed data present: 2 plans (Free, Pro), 6 prompt templates
  4. DB connectivity test passes in CI
**Plans**: Complete

### Phase 3: Backend Core
**Goal**: Users can authenticate and the API serves problems, submissions, and profile data with JWT protection
**Depends on**: Phase 2
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User can sign up, log in, and receive a JWT that persists across browser refreshes
  2. User can log out from any page and the session is cleared
  3. Calling a protected endpoint without a valid JWT returns 401
  4. `GET /problems` returns paginated results filterable by language, difficulty, and topic
  5. `POST /submissions` creates a submission record and `GET /users/me` returns the current user's profile
  6. First-time user is prompted to complete profile setup (display name, level, default language)
**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — Test scaffold (Wave 0): conftest + 5 test stub files covering all 12 requirements
- [ ] 03-02-PLAN.md — Backend auth foundation: config, deps, schemas, auth router, main.py wiring
- [ ] 03-03-PLAN.md — Frontend auth: Supabase packages, server/client utilities, proxy.ts, login/signup/profile-setup pages
- [ ] 03-04-PLAN.md — Problems + curriculum endpoints: GET /problems, GET /problems/{id}, GET /curriculum-paths, GET /curriculum-paths/{id}
- [ ] 03-05-PLAN.md — Users + submissions endpoints: GET /users/me, PATCH /users/me, POST /submissions

### Phase 4: LLM Abstraction Layer
**Goal**: The platform can route LLM calls, render prompts from DB templates, stream responses via SSE, and log every call
**Depends on**: Phase 3
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04
**Success Criteria** (what must be TRUE):
  1. A prompt template from the DB is rendered with runtime variables and sent to OpenRouter
  2. LLM response streams token-by-token to the frontend via SSE without buffering
  3. The correct OpenRouter model is selected based on user's plan (Free: Haiku/Llama, Pro: full selection)
  4. Every LLM call produces a row in `usage_events` with model, tokens, prompt_name, cost_usd, and user_id
**Plans**: TBD

### Phase 5: Practice Flow
**Goal**: Users can work through the full AI-assisted coding practice experience end-to-end
**Depends on**: Phase 4
**Requirements**: PRAC-01, PRAC-02, PRAC-03, PRAC-04, PRAC-05, PRAC-06, PRAC-07, PRAC-08
**Success Criteria** (what must be TRUE):
  1. User can browse the problem list with filters and open a problem in the three-panel IDE (problem | editor | AI)
  2. User can submit code and receive a streaming LLM code review with improved version and explanation
  3. User can request progressive hints (hint 1, 2, 3 — each deeper) without the solution being revealed
  4. User can view a solution at beginner, intermediate, or advanced depth
  5. User can trigger "Teach Me" to get a line-by-line streaming explanation, and can chat freeform with the AI about the current problem
  6. User can click "Surprise Me" and receive an LLM-generated problem matched to their skill level and language
**Plans**: TBD

### Phase 6: Skill Tracking + Custom Problems
**Goal**: The platform learns from each submission and users can add their own problems
**Depends on**: Phase 5
**Requirements**: PRAC-09, SKILL-01, SKILL-02, SKILL-03
**Success Criteria** (what must be TRUE):
  1. After each submission, a skill assessment runs async and saves a snapshot to `skill_snapshots`
  2. User's adaptive skill level (per language, 1–5) updates and is reflected in subsequent prompt rendering
  3. User can create a custom problem (title, description, examples, language) visible only to them
  4. Weak areas and next suggested topics appear in the skill snapshot and are available for downstream use
**Plans**: TBD

### Phase 7: Frontend Screens
**Goal**: All four standalone screens (Dashboard, Learn, Progress, Settings) are complete and SaaS-grade
**Depends on**: Phase 6
**Requirements**: SCR-01, SCR-02, SCR-03, SCR-04
**Success Criteria** (what must be TRUE):
  1. Dashboard shows skill level summary, streak, XP, recent activity, recommended problems, and a "Continue" prompt
  2. Learn screen shows curriculum paths with per-path progress and locked/unlocked lesson indicators
  3. Progress screen shows skill history chart, problems solved, submission history, weak areas, streak calendar, and language breakdown
  4. Settings screen allows updating profile, default language, LLM model (plan-gated), theme, and explanation style
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold | - | Complete | 2026-05-15 |
| 2. Database Schema | - | Complete | 2026-05-15 |
| 3. Backend Core | 0/5 | Not started | - |
| 4. LLM Abstraction Layer | 0/TBD | Not started | - |
| 5. Practice Flow | 0/TBD | Not started | - |
| 6. Skill Tracking + Custom Problems | 0/TBD | Not started | - |
| 7. Frontend Screens | 0/TBD | Not started | - |
