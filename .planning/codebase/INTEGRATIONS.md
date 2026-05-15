# External Integrations

**Analysis Date:** 2026-05-15

## APIs & External Services

**Authentication & BaaS:**
- Supabase - Auth provider and hosted PostgreSQL database
  - SDK/Client: `supabase>=2.30.0` (Python SDK, `backend/pyproject.toml`)
  - Auth env var: `SUPABASE_KEY` (publishable/anon key)
  - URL env var: `SUPABASE_URL`
  - Status: SDK installed and configured in settings; direct auth integration endpoints not yet implemented (only schema/config present)

**LLM Providers (schema-level integration, not yet wired):**
- Anthropic Claude - Default model is `anthropic/claude-sonnet-4-5` (stored in `UserSetting.llm_model`, `backend/models/content.py`)
- OpenAI GPT-4o - Available in Pro plan's `allowed_models` (`backend/seeds/plans.py`)
- Google Gemini 2.0 Flash - Available on Free and Pro plans
- Meta Llama 3.3 70B - Available on Free and Pro plans
- Integration point: LLM calls tracked via `UsageEvent` table (`backend/models/billing.py`) with `llm_model`, `tokens_used`, `cost_usd` columns
- Note: No LLM SDK is present in `pyproject.toml` yet; model names use `provider/model` slug format (OpenRouter or similar router pattern)

**Payments:**
- Stripe - Subscription billing
  - Schema references: `Plan.stripe_price_id`, `Subscription.stripe_sub_id` (`backend/models/billing.py`)
  - No Stripe SDK in `pyproject.toml` yet; integration not implemented
  - Env var anticipated: not present in `.env.example` yet

## Data Storage

**Databases:**
- PostgreSQL (Supabase-hosted)
  - Connection: `DATABASE_URL` env var (format: `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres`)
  - Client: SQLAlchemy 2.0 ORM with psycopg2-binary driver
  - Session factory: `backend/db/session.py` (`create_engine` with `pool_pre_ping=True`)
  - 13 tables across 4 domain groups (users, billing, learning, content)

**File Storage:**
- Supabase Storage - Available via Supabase SDK (not yet used in application code)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: Supabase SDK installed; auth enforcement not yet wired into FastAPI routes
  - User identity: `User.id` is a UUID (Supabase auth UUIDs expected to match)
  - `User.email` stored locally in `backend/models/users.py` alongside Supabase-managed auth
  - CORS configured to allow only `FRONTEND_URL` (`backend/main.py`)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Python stdlib logging via Alembic config (`alembic.ini` defines root/sqlalchemy/alembic loggers)
- No structured logging library (no loguru, structlog, etc.)
- SQLAlchemy engine logging at WARNING level

## CI/CD & Deployment

**Hosting:**
- Not specified in repo; no deployment config files found (no `Procfile`, `fly.toml`, `render.yaml`, `railway.json`)

**CI Pipeline:**
- None detected (no `.github/workflows/`, no CircleCI/GitLab CI config)

## Environment Configuration

**Required env vars (`backend/.env.example`):**
- `DATABASE_URL` - PostgreSQL connection string (Supabase pooler)
- `SUPABASE_URL` - Supabase project URL (`https://YOUR_PROJECT_REF.supabase.co`)
- `SUPABASE_KEY` - Supabase publishable/anon key

**Optional env vars:**
- `APP_NAME` - Defaults to `"CodeMentor API"`
- `DEBUG` - Defaults to `false`
- `FRONTEND_URL` - Defaults to `http://localhost:3000` (used for CORS)

**Secrets location:**
- `backend/.env` file (present, not committed — in `.gitignore`)
- `backend/.env.example` is the committed reference template

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook endpoint - Not yet implemented (anticipated for subscription lifecycle events)
- Supabase auth webhook - Not yet implemented

**Outgoing:**
- None detected

## Database Schema Overview

The 13-table schema covers four domains, all using UUID primary keys and PostgreSQL-specific types (JSONB, ARRAY):

**Users domain** (`backend/models/users.py`):
- `users` - Core user profiles with `profile_level` (kid|student|engineer), XP, streaks
- `organizations` - Multi-seat org accounts
- `org_members` - Membership with roles (owner|admin|member)

**Billing domain** (`backend/models/billing.py`):
- `plans` - Subscription tiers with `stripe_price_id`, `allowed_models` array, feature flags
- `subscriptions` - Active subscriptions linked to Stripe (`stripe_sub_id`)
- `usage_events` - LLM call tracking with token counts and cost

**Learning domain** (`backend/models/learning.py`):
- `problems` - Coding problems (python|sql, easy|medium|hard)
- `submissions` - User code submissions with LLM review results
- `skill_snapshots` - Periodic skill state snapshots per user

**Content domain** (`backend/models/content.py`):
- `chat_sessions` - Conversation history stored as JSONB messages array
- `curriculum_paths` - Ordered problem sequences per language/level
- `prompts` - Versioned LLM prompt templates with variable placeholders
- `user_settings` - Per-user preferences (LLM model, theme, explain style)

---

*Integration audit: 2026-05-15*
