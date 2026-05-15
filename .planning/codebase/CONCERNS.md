# Codebase Concerns

**Analysis Date:** 2026-05-15

---

## Tech Debt

**No Pydantic response schemas:**
- Issue: The API layer has zero Pydantic schemas. No request validation or response serialization models exist anywhere in `backend/api/` or `backend/models/`. FastAPI's primary safety guarantee (auto-validation, auto-docs) is entirely unused.
- Files: `backend/api/` (directory contains only `health.py`), `backend/models/` (SQLAlchemy only)
- Impact: Every future endpoint ships without validated input/output contracts. When models are added ad-hoc, response shapes diverge silently.
- Fix approach: Create `backend/schemas/` with one Pydantic `BaseModel` per domain (e.g., `ProblemOut`, `SubmissionIn`, `UserOut`) before Phase 3 endpoints are written.

**Enumerated string columns are plain `String` with no DB-level constraint:**
- Issue: Fields like `profile_level` (kid|student|engineer), `difficulty` (easy|medium|hard), `role` (owner|admin|member), `source` (curated|user|llm), `session_type` (teach_me|freeform), `trigger` (submission|manual|scheduled) are all `String` columns with allowed values documented only in code comments.
- Files: `backend/models/users.py:32`, `backend/models/learning.py:17,60`, `backend/models/users.py:55`, `backend/models/content.py:22`, `backend/models/learning.py:60`
- Impact: Invalid values can be inserted at the DB level with no error. Logic bugs pass silently.
- Fix approach: Use PostgreSQL `ENUM` types via SQLAlchemy `Enum(...)` on all constrained string columns, or add `CheckConstraint` per column, then generate a new Alembic migration.

**`supabase_key` and `supabase_url` are configured but unused:**
- Issue: `core/config.py` has `supabase_url` and `supabase_key` fields and the `supabase` SDK is in `pyproject.toml` dependencies, but no code ever instantiates a Supabase client.
- Files: `backend/core/config.py:12-13`, `backend/pyproject.toml`
- Impact: Dead dependency adding install weight. When auth/RLS integration begins, there is no established pattern to follow.
- Fix approach: Either create `backend/core/supabase.py` with a shared client singleton now, or remove the `supabase` dependency until Phase 4 (Auth) when it will be needed.

**`get_db` dependency never wired into any endpoint:**
- Issue: `backend/db/session.py` defines `get_db()` as a FastAPI dependency, but no router uses `Depends(get_db)` — the only router is `health.py` which makes no DB calls.
- Files: `backend/db/session.py:10-15`, `backend/api/health.py`
- Impact: Any Phase 3 endpoint that forgets `Depends(get_db)` will open a raw `SessionLocal()` without cleanup, causing connection leaks. The working pattern is defined but not yet modeled for developers to copy.
- Fix approach: Add a trivial DB-touching endpoint (e.g., health check that pings the DB) to establish and validate the `Depends(get_db)` pattern before Phase 3 starts.

**Seed scripts open sessions independently of `get_db`:**
- Issue: `backend/seeds/plans.py` and `backend/seeds/prompts.py` each call `SessionLocal()` directly with manual `try/finally` close, duplicating session lifecycle code that already exists in `get_db`.
- Files: `backend/seeds/plans.py:5-36`, `backend/seeds/prompts.py:44-54`
- Impact: If `get_db` is later modified (e.g., to add scoped sessions or tracing), seeds silently diverge.
- Fix approach: Extract a `with_db(fn)` context manager helper or use `next(get_db())` in seeds.

**`Organization.subscription_id` and `User.subscription_id` are untyped UUID references without FK:**
- Issue: Both `Organization.subscription_id` and `User.subscription_id` are `UUID(as_uuid=True)` columns with no `ForeignKey("subscriptions.id")` constraint. The relationship to `subscriptions` is implied but unenforced.
- Files: `backend/models/users.py:18,39`
- Impact: Orphaned subscription IDs can be stored. Cascading deletes or integrity checks will not work.
- Fix approach: Add `ForeignKey("subscriptions.id")` to both columns (nullable=True) and generate a migration.

**`ChatSession.submission_id` has no FK constraint:**
- Issue: `ChatSession.submission_id` is a bare UUID column with no `ForeignKey("submissions.id")` despite always referencing a submission.
- Files: `backend/models/content.py:21`
- Impact: Orphaned chat sessions pointing to deleted submissions with no referential protection.
- Fix approach: Add `ForeignKey("submissions.id", nullable=True)` and regenerate the migration.

**`OrgMember.invited_by` has no FK constraint:**
- Issue: `OrgMember.invited_by` is a bare UUID with no `ForeignKey("users.id")`.
- Files: `backend/models/users.py:56`
- Impact: Cannot enforce that the inviter is a valid user. Referential integrity gap.
- Fix approach: Add `ForeignKey("users.id", nullable=True)`.

**No database indexes beyond primary keys and the two unique constraints:**
- Issue: The migration (`backend/db/migrations/versions/8b1d998d31f6_initial_schema.py`) creates no indexes. High-traffic query patterns are obvious: `submissions` filtered by `user_id` or `problem_id`, `usage_events` filtered by `user_id`, `problems` filtered by `language`/`difficulty`/`is_published`, `chat_sessions` by `user_id`.
- Files: `backend/db/migrations/versions/8b1d998d31f6_initial_schema.py`
- Impact: Table scans on every core read path once data volume grows. Particularly acute for `usage_events` which logs every LLM call.
- Fix approach: Add `Index` definitions in SQLAlchemy models on the FK columns used in filters, then generate a new migration before Phase 3 goes live.

**`Float` used for monetary amounts:**
- Issue: `Plan.price_monthly`, `Plan.price_yearly`, and `UsageEvent.cost_usd` use SQLAlchemy `Float` (IEEE 754 binary float).
- Files: `backend/models/billing.py:16-17,54`
- Impact: Floating-point rounding errors accumulate in financial calculations. `0.1 + 0.2 != 0.3` class bugs in billing totals.
- Fix approach: Migrate these columns to `Numeric(precision=10, scale=4)` before any billing logic is written.

---

## Security Considerations

**No authentication layer exists anywhere in the backend:**
- Risk: The API exposes all future endpoints without identity or authorization. There is no JWT validation, no Supabase Auth token verification, no `get_current_user` dependency.
- Files: `backend/api/health.py`, `backend/main.py`, `backend/core/config.py`
- Current mitigation: There are no data endpoints yet; only `/health` exists.
- Recommendations: Before Phase 3 ships any data endpoint, implement a `get_current_user` FastAPI dependency that validates Supabase JWT tokens from the `Authorization: Bearer` header. Every data endpoint must `Depends(get_current_user)`.

**CORS allows any method and any header from the single origin:**
- Risk: `allow_methods=["*"]` and `allow_headers=["*"]` permits the frontend to issue DELETE, PUT, PATCH requests and custom headers. While scoped to `settings.frontend_url`, this is broader than needed.
- Files: `backend/main.py:9-15`
- Current mitigation: Origin is locked to `settings.frontend_url`.
- Recommendations: Restrict `allow_methods` to the HTTP verbs actually used (`["GET", "POST", "PUT", "DELETE"]`) and enumerate `allow_headers` explicitly once the auth header is known.

**Supabase RLS is not yet configured:**
- Risk: The design spec calls for Supabase Row Level Security to isolate all tenant data. No RLS policies exist yet (migrations do not contain them). Raw `DATABASE_URL` access bypasses RLS entirely.
- Files: `backend/db/session.py`, `backend/db/migrations/versions/8b1d998d31f6_initial_schema.py`
- Current mitigation: No user data is stored yet; only seed data.
- Recommendations: Define RLS policies in a dedicated Alembic migration or Supabase SQL editor before any user data endpoints are live. The FastAPI backend connecting via service role must explicitly set `request.jwt.claims` or use the anon key for user-scoped queries.

**`database_url` defaults to empty string without validation:**
- Risk: If `.env` is missing, `settings.database_url = ""` causes a cryptic `OperationalError` on first DB call instead of a clear startup failure.
- Files: `backend/core/config.py:11`
- Current mitigation: Tests fail fast if DB is unreachable.
- Recommendations: Add a `@field_validator` that raises `ValueError` on empty `database_url` at app startup.

---

## Performance Bottlenecks

**`ChatSession.messages` stores entire chat history as a JSONB blob:**
- Problem: All chat messages for a session are stored as a single JSONB array on the `chat_sessions` row. Every message append rewrites the entire blob.
- Files: `backend/models/content.py:23`
- Cause: JSONB append requires a full row update in PostgreSQL. Large conversations (100+ messages) result in increasingly expensive writes and bloated row sizes.
- Improvement path: Add a `chat_messages` table with `session_id FK`, `role`, `content`, `position` for normalized message storage. Deprecate `messages JSONB` in a v2 migration.

**`usage_events` has no partitioning or TTL strategy:**
- Problem: Every LLM call inserts one row. At scale (500 calls/user/month × users), this table grows unboundedly with no index or cleanup policy.
- Files: `backend/models/billing.py:43-55`
- Cause: No index on `user_id` or `created_at`; no partition by month defined.
- Improvement path: Add a `created_at` index immediately. Plan Postgres range partitioning by month for v2.

---

## Fragile Areas

**Test suite hits the live production Supabase database:**
- Files: `backend/tests/conftest.py`, `backend/tests/test_db_connection.py`
- Why fragile: `conftest.py` creates a `SessionLocal()` pointing at `settings.database_url` — the same Supabase instance used in production. Tests that write data (future CRUD tests) will pollute production. Tests require network access and will fail in CI without credentials.
- Safe modification: Tests should use a separate test database URL (`TEST_DATABASE_URL` env var) or an in-memory SQLite engine for unit-level tests. The `conftest.py` `db` fixture needs an override mechanism.
- Test coverage: All 5 current tests pass only when live Supabase is reachable.

**No test isolation — `db` fixture does not roll back between tests:**
- Files: `backend/tests/conftest.py:14-19`
- Why fragile: The `db` fixture yields a plain `SessionLocal()` session with no transaction wrapping or rollback. Tests that write data leave it in the DB between runs, causing flaky order-dependent tests as the suite grows.
- Safe modification: Wrap the session in a savepoint (`session.begin_nested()`) and roll back after each test, or use `pytest-postgresql` with a fresh DB per test run.

**Seed idempotency check is count-based, not content-based:**
- Files: `backend/seeds/plans.py:8`, `backend/seeds/prompts.py:47`
- Why fragile: Seeds skip if `count() > 0`. If a plan or prompt needs to be updated, re-running seeds does nothing. Changes to seed data require manual DB surgery.
- Safe modification: Use upsert logic (`merge` or `INSERT ... ON CONFLICT DO UPDATE`) keyed on `name` instead of count checks.

**`pytest-asyncio` is installed but no async mode is configured:**
- Files: `backend/pyproject.toml:22`, `backend/tests/conftest.py`
- Why fragile: `pytest-asyncio >= 0.21` requires explicit `asyncio_mode = "auto"` or `@pytest.mark.asyncio` on each async test. Without configuration, any async test added will fail with an unhelpful error.
- Safe modification: Add `asyncio_mode = "auto"` to `[tool.pytest.ini_options]` in `pyproject.toml`.

---

## Missing Critical Features

**No OpenRouter / LLM integration layer:**
- Problem: The entire core value proposition — streaming LLM code review — has no implementation. No `llm/` package, no `openrouter_api_key` in config, no SSE endpoint.
- Blocks: Submissions endpoint, hints, solutions, teach_me chat, surprise_me, skill assessor — all LLM-dependent features are blocked.

**No authentication (Phase 4, but blocks Phase 3):**
- Problem: No Supabase Auth JWT validation, no `get_current_user` dependency, no user session concept in the API.
- Blocks: All data endpoints that need to scope data by user (`GET /users/me`, `POST /submissions`, `GET /problems` with personalization) are unsafe to ship without auth.

**No Pydantic schemas layer:**
- Problem: FastAPI's request validation and OpenAPI documentation generation both require `BaseModel` schemas. None exist.
- Blocks: Auto-generated Swagger UI will be empty or incorrect; frontend has no contract to depend on.

**Frontend is a single placeholder page:**
- Problem: `frontend/app/page.tsx` renders a heading, paragraph, and non-functional button. No routing, no auth, no API calls, no Monaco editor, no dashboard, no practice view.
- Files: `frontend/app/page.tsx`
- Blocks: All user-facing functionality.

**No frontend API client or SSE handler:**
- Problem: `lib/api.ts` and `lib/sse.ts` are called for in the design spec but do not exist.
- Files: `frontend/lib/` (contains only `utils.ts`)
- Blocks: Any frontend-to-backend communication.

---

## Test Coverage Gaps

**Zero coverage of any business logic:**
- What's not tested: Models beyond existence (no CRUD round-trip tests), all future API endpoints, seed logic correctness, Pydantic schema validation (none exist yet), LLM integration (none exists yet).
- Files: `backend/tests/` (2 test files total)
- Risk: Regressions in core domain logic will be invisible.
- Priority: High — establish CRUD tests for `Problem`, `Submission`, `User` before Phase 3 ships.

**No frontend tests of any kind:**
- What's not tested: All React components, routing, API integration, SSE streaming.
- Files: `frontend/` (no test files exist; no Jest/Vitest/Playwright config)
- Risk: UI regressions are caught only by manual inspection.
- Priority: Medium — add at minimum component tests when the first real UI is built.

**No test for duplicate seed prevention:**
- What's not tested: Running `seed_plans()` or `seed_prompts()` twice does not double-insert.
- Files: `backend/seeds/plans.py`, `backend/seeds/prompts.py`
- Risk: Seed scripts are run manually; double-execution is a real operational risk.
- Priority: Low.

---

## Dependencies at Risk

**`next` pinned to `16.2.6` — a pre-release / non-standard version:**
- Risk: Next.js public stable release is currently in the 14.x / 15.x range. Version `16.2.6` is either a pre-release or a private fork. The `frontend/AGENTS.md` explicitly warns: "This is NOT the Next.js you know — APIs, conventions, and file structure may all differ from your training data."
- Impact: Community resources, Stack Overflow answers, and AI assistant suggestions for Next.js will not reliably apply. Debugging will be harder.
- Migration plan: Confirm whether 16.x is intentional and document the divergences in `AGENTS.md`; alternatively pin to a stable 14.x release.

**`lucide-react` pinned to `^1.16.0`:**
- Risk: `lucide-react` stable is in the `0.x` range. Version `1.16.0` may be a pre-release with breaking API changes.
- Files: `frontend/package.json`
- Impact: Icon names or import paths may differ from documented lucide-react usage.
- Migration plan: Verify version stability; pin to a known-stable release if pre-release.

---

*Concerns audit: 2026-05-15*
