# Requirements: CodeMentor

**Defined:** 2026-05-15
**Core Value:** Users write code, submit, and instantly learn — the LLM reviews it, shows a better version, and teaches why, all in one flow.

## Already Validated (Phases 1–2)

- ✓ Project scaffold: FastAPI backend, Next.js frontend, Makefile, Supabase connection
- ✓ All 13 DB tables deployed and tested in Supabase PostgreSQL 17
- ✓ Seed data: 2 subscription plans, 6 prompt templates

## v1 Requirements

### API — Backend REST Endpoints

- [ ] **API-01**: System exposes `GET /problems` — paginated, filterable by language/difficulty/topic
- [ ] **API-02**: System exposes `GET /problems/{id}` — single problem detail
- [ ] **API-03**: System exposes `POST /submissions` — creates submission record linked to problem + user
- [ ] **API-04**: System exposes `GET /users/me` — current user profile + skill level
- [ ] **API-05**: System exposes `PATCH /users/me` — update profile fields (display name, avatar, profile level)
- [ ] **API-06**: System exposes `GET /curriculum-paths` — list published paths
- [ ] **API-07**: System exposes `GET /curriculum-paths/{id}` — path detail with ordered problems

### AUTH — Authentication & Authorization

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in and receive a JWT session that persists across browser refreshes
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: All protected API endpoints validate Supabase JWT via middleware
- [ ] **AUTH-05**: First-time user is guided through profile setup (display name, profile level: kid/student/engineer, default language)

### LLM — LLM Abstraction Layer

- [ ] **LLM-01**: Prompt templates loaded from DB and rendered with runtime variables
- [ ] **LLM-02**: Model router resolves which OpenRouter model to use per user (user_settings.llm_model, validated against plan.allowed_models)
- [ ] **LLM-03**: LLM responses stream via Server-Sent Events (SSE) — FastAPI proxies OpenRouter stream to frontend
- [ ] **LLM-04**: All LLM calls logged to `usage_events` (model, tokens, prompt_name, cost_usd, user_id)

### PRACTICE — Core Practice Flow

- [ ] **PRAC-01**: User can view and browse the problem list with language, difficulty, and topic filters
- [ ] **PRAC-02**: User can open a problem in the three-panel IDE layout (problem description | Monaco editor | AI assistant)
- [ ] **PRAC-03**: User can submit code and receive a streaming LLM code review (issues found, improved version, explanation)
- [ ] **PRAC-04**: User can request a progressive hint (hint 1, 2, 3 — each deeper) without seeing the solution
- [ ] **PRAC-05**: User can view a solution at a chosen depth level (beginner / intermediate / advanced)
- [ ] **PRAC-06**: User can trigger "Teach Me" — line-by-line explanation of their submitted or solution code, streamed
- [ ] **PRAC-07**: User can open an interactive AI chat anchored to the current problem/submission (freeform Q&A)
- [ ] **PRAC-08**: User can click "Surprise Me" to receive an LLM-generated problem tailored to their current skill level and language preference
- [ ] **PRAC-09**: User can add a custom problem (title, description, examples, language) that only they can see

### SKILL — Adaptive Skill Tracking

- [ ] **SKILL-01**: After each submission, skill level is re-assessed async (LLM skill_assessor prompt, last 10 submissions)
- [ ] **SKILL-02**: Skill snapshot is saved to `skill_snapshots` with weak areas and next suggested topics
- [ ] **SKILL-03**: Users's adaptive skill level (per language, 1–5 scale) is reflected in all downstream prompt rendering

### SCREENS — App Screens

- [ ] **SCR-01**: Dashboard shows: skill level summary, streak, XP, recent activity, recommended problems, "Continue where you left off"
- [ ] **SCR-02**: Learn screen shows curriculum paths (Python track, SQL track) with progress per path and locked/unlocked lessons
- [ ] **SCR-03**: Progress screen shows: skill level history chart, problems solved count, submission history, weak areas, streak calendar, language breakdown
- [ ] **SCR-04**: Settings screen: profile (name, avatar, profile level), default language, LLM model selector (plan-gated), theme (dark/light), explanation style (eli5/technical/analogy)

## v2 Requirements

### Organizations & Teams

- **ORG-01**: Organization owner can invite members (email invitation)
- **ORG-02**: Org admin can create org-private problems and curriculum paths
- **ORG-03**: Org owner can view aggregate progress across all members

### Billing

- **BILL-01**: User can upgrade to Pro subscription via Stripe
- **BILL-02**: Free plan enforces monthly LLM call limits
- **BILL-03**: Pro plan unlocks full model selection

### Notifications

- **NOTF-01**: User receives daily streak reminder email
- **NOTF-02**: User can configure notification preferences

## Out of Scope

| Feature | Reason |
|---------|--------|
| Code execution / sandbox | High complexity, security risk; LLM reviews static code for v1 |
| OAuth / social login | Email/password sufficient for v1 |
| Real-time multiplayer / pair coding | Not core to individual learning flow |
| Mobile native app | Web-first; browser works on mobile |
| Video content | Not a core learning mode |
| Admin dashboard | Deferred to v2 ops tooling |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01–07 | — | Pending |
| AUTH-01–05 | — | Pending |
| LLM-01–04 | — | Pending |
| PRAC-01–09 | — | Pending |
| SKILL-01–03 | — | Pending |
| SCR-01–04 | — | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0 (roadmap not yet created)
- Unmapped: 33 ⚠️

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15 after initial definition*
