# CodeMentor — Design Spec
**Date:** 2026-05-15  
**Status:** Approved  

---

## 1. Overview

CodeMentor is a coding learning platform for Python and SQL (extensible to other languages) targeting kids, students, and engineers. Users solve coding problems in a browser-based IDE, submit their code to an LLM for review, get hints and solutions at chosen difficulty levels, and learn interactively through a built-in AI tutor. The system tracks each user's skill level adaptively and adjusts problem recommendations accordingly.

**Core differentiators:**
- LLM-powered code review with improved code suggestion and explanation
- Adaptive skill tracking — the app gets smarter about each user over time
- Interactive "Teach Me" chat mode for deep understanding
- OpenRouter LLM gateway — any model, user-selectable, subscription-tier gated
- SaaS-ready from day 1 (orgs, billing, usage tracking)

---

## 2. Target Users

| Profile | Description | App Behaviour |
|---|---|---|
| `kid` | Ages 10–18, no prior experience | Simple language, analogies, heavy hints, gamification |
| `student` | College / career switchers | Structured curriculum, interview prep, moderate difficulty |
| `engineer` | Working professionals | LeetCode-style, complexity analysis, industry-standard solutions |

User selects profile at signup. LLM adapts tone, hint depth, and solution style to this profile. Skill level within each profile is tracked separately per language.

---

## 3. Architecture

### Pattern
**Clean Separation** — Next.js frontend + FastAPI backend as two independently deployed services.

### Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router), TypeScript | Vercel deployment |
| UI | Tailwind CSS + shadcn/ui | Dark/light theme, accessible |
| Code Editor | Monaco Editor | VS Code-quality, Python + SQL syntax |
| Backend | FastAPI (Python) | Railway or Render deployment |
| Database | PostgreSQL via Supabase | Auth, RLS, real-time |
| Auth | Supabase Auth | Email + OAuth (Google, GitHub) |
| LLM Gateway | OpenRouter | All models via one API key |
| Billing (future) | Stripe | Subscription management |

### Communication
- REST API for standard CRUD operations
- **Server-Sent Events (SSE)** for all LLM responses — tokens stream in real-time to the browser
- Supabase real-time for streak/XP updates

### Deployment
```
Browser → Vercel (Next.js) → Railway (FastAPI) → Supabase (PostgreSQL)
                                               → OpenRouter (LLM)
```

---

## 4. UI Layout

### Navigation
Top nav bar with: Dashboard | Practice | Learn | Progress | Settings | User avatar

### Problem-Solving View (3-Panel)
Three collapsible panels, each independently minimizable:

| Panel | Contents | Default state |
|---|---|---|
| Left sidebar | Problem list with filters (language, difficulty, topic, search). Solved/unsolved indicators. | Open |
| Center | Problem description (collapsible top section) + Monaco editor (main area) + Submit button + 🎲 Surprise Me | Always open |
| Right | AI Assistant panel: review output, Hint, Solution, Teach Me, Chat buttons | Open |

When a panel is minimized it collapses to an icon strip, preserving screen space.

### Other Screens
- **Dashboard** — skill summary, streak, XP, recommended problems, Surprise Me CTA, continue where left off
- **Learn** — curriculum paths (Python track, SQL track), locked/unlocked lessons, progress per track
- **Progress** — skill level history chart, weak areas (LLM-identified), submission history, streaks calendar
- **Settings** — profile, default language, LLM model selector, theme, explanation style, solution level preference

---

## 5. Core Features

### 5.1 Problem Solving Flow
1. User picks a problem from the library or triggers Surprise Me
2. Writes code in Monaco editor
3. Clicks Submit → code sent to FastAPI
4. FastAPI builds prompt from registry, calls OpenRouter with SSE
5. LLM review streams token-by-token into the right panel:
   - Issues identified in user's code
   - Improved version of the code
   - Explanation of why the improved version is better
6. Skill assessment runs async after submission (does not block UI)

### 5.2 Hint System
- Progressive hints: up to 3 hints per problem, each click reveals one more (never the solution)
- Hint language adapts to user profile (simple analogy for kids, technical nudge for engineers)
- After 3 hints, the Hint button is replaced with "Show Solution" prompt
- `hints_used` count stored on submission

### 5.3 Solution Levels
When user requests a solution, they choose a level:

| Level | Description |
|---|---|
| Beginner | Simple, heavily commented, avoids advanced constructs |
| Learner | Clean, idiomatic, follows best practices |
| Industry Standard | Production-quality, handles edge cases and errors |
| Optimal (Time) | Best time complexity, may sacrifice readability |
| Optimal (Space) | Best space complexity |
| Interview Ready | What a senior engineer writes in a real interview |

### 5.4 Teach Me
- Default: line-by-line explanation at user's profile level
- User can switch style: "Explain like I'm 10" / "Technical" / "Use analogies"
- **Interactive mode**: full chat with LLM about the solution — ask follow-up questions, request alternative approaches, explore edge cases. Session stored in `chat_sessions` table; maintains full message history for context.

### 5.5 Surprise Me
- LLM generates a fresh problem on demand based on:
  - User's selected language
  - Current skill level (from latest `skill_snapshots`)
  - Recent problem history (avoid repeats via `avoid_recent_ids`)
  - Optional topic focus
- Problem is saved to `problems` table with `source = 'llm'`

### 5.6 Problem Library
- Curated problems added by admin
- User-submitted problems (submitted for admin review; admin can approve, reject, or trigger LLM polish before publishing)
- LLM-generated problems (admin can trigger bulk generation for the library)
- All problems stored in `problems` table with `source` enum: `curated | user | llm`
- `org_id` on problem row = org-private; null = public

### 5.7 Adaptive Skill Tracking
- After each submission, LLM assesses skill level async
- Assessment considers last 10 submissions per language
- Returns structured JSON: `{level: 3.2, weak: ["list comprehensions"], next: ["generators"]}`
- Stored as a new row in `skill_snapshots` (time-series, never overwritten)
- `users.skill_level` jsonb updated with latest snapshot values
- Drives problem recommendations, Surprise Me difficulty, and hint depth

### 5.8 First-Run Experience
- Profile setup wizard after signup
- Level assessment: 3–5 quick problems to calibrate initial skill level; user can skip (defaults to level 1)
- Generates first `skill_snapshot` before user enters the main app
- Skipped assessment can be retaken later from Settings

---

## 6. LLM Abstraction Layer

### Prompt Registry
All prompts stored in the `prompts` DB table, versioned. No redeployment needed to tune prompts.

| Prompt name | Purpose | Key variables |
|---|---|---|
| `code_review` | Review submission, suggest improved code | `code, language, problem, user_level` |
| `hint_generator` | Progressive hint (n of max 3) | `problem, code_so_far, hint_number, user_level` |
| `solution_generator` | Solution at chosen level | `problem, language, solution_level, user_level` |
| `teach_me` | Line-by-line explanation | `code, explain_style, user_level, language` |
| `surprise_me` | Generate a new problem | `language, user_skill_level, topic_focus, avoid_recent_ids` |
| `skill_assessor` | Assess skill from submission history | `recent_submissions, current_level` |

### Model Router
Configured via `models.yaml`. User setting overrides default per-user. Plan tier gates available models.

```yaml
models:
  - id: anthropic/claude-sonnet-4-5
    name: "Claude Sonnet 4.5"
    tier: free
  - id: openai/gpt-4o
    name: "GPT-4o"
    tier: pro
  - id: google/gemini-2.0-flash
    name: "Gemini 2.0 Flash"
    tier: free
  - id: meta-llama/llama-3.3-70b
    name: "Llama 3.3 70B"
    tier: free

default_model: anthropic/claude-sonnet-4-5
```

### Streaming
All LLM responses use SSE. FastAPI opens an SSE stream to OpenRouter and passes tokens through to the Next.js frontend as they arrive. Interactive chat (Teach Me) maintains a `messages` array per session for conversation context.

### Skill assessment
Runs as a background task after submission completes — does not block the review stream. Uses structured JSON output mode to ensure parseable response.

---

## 7. Database Schema

13 tables across 4 groups. Full SaaS-ready design — SaaS tables are additive and don't affect v1 solo-user flow.

### Identity & Auth
- **users** — id, email, display_name, profile_level, skill_level (jsonb), streak_days, xp_total, org_id (FK nullable), subscription_id (FK), is_admin, created_at, deleted_at
- **organizations** — id, name, slug, owner_id, subscription_id, max_seats, created_at, deleted_at
- **org_members** — id, org_id, user_id, role (owner|admin|member), invited_by, joined_at, removed_at

### Billing & Subscriptions
- **plans** — id, name, price_monthly, price_yearly, allowed_models (text[]), llm_calls_per_month, max_seats, features (jsonb), stripe_price_id, is_active
- **subscriptions** — id, plan_id, entity_type (user|org), entity_id, status, stripe_sub_id, current_period_start/end, cancel_at_period_end
- **usage_events** — id, user_id, org_id, event_type, llm_model, tokens_used, prompt_name, cost_usd, created_at

### Learning Core
- **problems** — id, title, description (markdown), language, difficulty, topic (text[]), examples (jsonb), constraints, source (curated|user|llm), created_by, org_id (nullable), is_published, created_at
- **submissions** — id, user_id, problem_id, code, language, llm_review, improved_code, llm_model_used, hints_used, solution_viewed, solution_level, score, created_at
- **skill_snapshots** — id, user_id, snapshot (jsonb), trigger (submission|manual|scheduled), created_at

### Engagement & Content
- **chat_sessions** — id, user_id, problem_id, submission_id, session_type (teach_me|freeform), messages (jsonb[]), created_at, updated_at
- **curriculum_paths** — id, language, title, ordered_problem_ids (uuid[]), target_level, description, org_id (nullable), is_published
- **prompts** — id, name, version, template, variables (text[]), is_active, created_at
- **user_settings** — user_id (PK), default_language, llm_model, theme, explain_style, solution_level, sidebar_prefs (jsonb)

### SaaS design principles
- `org_id` on `problems` and `curriculum_paths` → org-private content
- `plans.allowed_models` → gates LLM model choice by subscription tier
- `usage_events` → per-user cost tracking and rate limiting
- `org_members` → school/team seat management
- Supabase RLS isolates all tenant data
- Soft deletes via `deleted_at` on users and organizations
- `description_embedding vector(1536)` — reserved for pgvector semantic search (v2)

---

## 8. Project Structure

```
help_me_code/
├── frontend/                    # Next.js 14 app
│   ├── app/
│   │   ├── (auth)/              # login, signup, onboarding
│   │   ├── dashboard/
│   │   ├── practice/
│   │   │   ├── page.tsx         # problem browser
│   │   │   └── [id]/page.tsx    # 3-panel solving view
│   │   ├── learn/
│   │   ├── progress/
│   │   └── settings/
│   ├── components/
│   │   ├── editor/              # Monaco wrapper
│   │   ├── ai-panel/            # review, hints, solution, teach, chat
│   │   └── ui/                  # shadcn components
│   └── lib/
│       ├── api.ts               # FastAPI client
│       └── sse.ts               # SSE stream handler
│
├── backend/                     # FastAPI app
│   ├── api/
│   │   ├── problems.py
│   │   ├── submissions.py
│   │   ├── chat.py
│   │   ├── users.py
│   │   └── skill.py
│   ├── llm/
│   │   ├── router.py            # model selection logic
│   │   ├── registry.py          # prompt loading from DB
│   │   ├── stream.py            # SSE passthrough
│   │   └── parser.py            # structured output parsing
│   ├── models/                  # SQLAlchemy / Pydantic models
│   ├── config/
│   │   └── models.yaml          # available LLM models config
│   └── db/
│       └── migrations/          # Alembic migrations
│
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-15-codementor-design.md
```

---

## 9. Out of Scope (v1)

- **Code execution / sandboxing** — LLM-only review for v1; architecture supports adding this later
- **Billing / Stripe integration** — schema is ready, integration is v2
- **Mobile app** — responsive web only
- **Other languages** — Python and SQL first; language is a config field, adding more is low-effort
- **pgvector semantic search** — column reserved, implementation is v2
- **Org admin dashboard** — org tables exist, admin UI is v2

---

## 10. Success Criteria (v1)

- User can sign up, complete level assessment, and land on a personalised dashboard
- User can browse, filter, and solve problems in the 3-panel editor
- Code submission triggers streaming LLM review with improved code
- Progressive hints work without revealing the solution
- Solution view offers all 6 levels
- Teach Me interactive chat works end-to-end
- Surprise Me generates a contextually appropriate problem
- Skill level updates after each submission and visibly changes recommendations
- LLM model is selectable in Settings and validated against plan tier
- All user data is isolated via Supabase RLS
