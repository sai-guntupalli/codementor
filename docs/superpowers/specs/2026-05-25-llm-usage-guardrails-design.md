# LLM Usage Tracking & Guardrails — Design Spec

**Date:** 2026-05-25
**Status:** Draft

---

## Problem Statement

The platform logs LLM calls to `usage_events` but never enforces the per-plan quota
(`llm_calls_per_month`). Free users can make unlimited AI calls. There is also no visibility
into usage for users or operators, no rate limiting against spam, and no cost-fallback when
OpenRouter omits billing metadata. This spec closes all of those gaps.

---

## Current State

| Concern | Current | Gap |
|---|---|---|
| Monthly quota | Stored on `Plan`, never read | Free users unlimited |
| Per-minute rate limit | None | Spam / abuse |
| Token cap per prompt | None | Runaway completions |
| User usage visibility | None | No endpoint, no UI |
| Cost accuracy | 0.0 when OR omits | No fallback pricing |
| UsageEvent richness | Missing `problem_id`, `input_tokens`, `output_tokens` | Limited analytics |
| Soft-limit warning | None | User surprised by hard block |
| Admin aggregate view | None | Can't measure platform cost |

---

## Goals

1. Enforce monthly LLM call quota — hard block at limit, soft warning at 80 %.
2. Add per-minute rate limiting per user.
3. Cap tokens per prompt type to prevent runaway completions.
4. Expose `GET /users/me/usage` so users know their consumption.
5. Show usage meter in Settings and a subtle counter in the IDE.
6. Compute accurate cost using a fallback pricing table when OpenRouter omits it.
7. Enrich `UsageEvent` with `problem_id`, `input_tokens`, `output_tokens`.
8. Add `GET /admin/usage` for operator aggregate metrics.

---

## Non-Goals

- IP-based rate limiting (handled at the reverse-proxy / CDN layer).
- Dollar-cap budgets per user (call-count quota is sufficient for v1).
- Real-time streaming cost display in the IDE (too noisy).

---

## Approach

Three layered mechanisms:

```
Request
  │
  ├─ 1. Per-minute rate limit (FastAPI middleware, in-memory counter)
  │        Blocks burst spam before hitting DB.
  │
  ├─ 2. Monthly quota check (FastAPI dependency, injected on LLM endpoints)
  │        Reads count(usage_events) for current period vs plan.llm_calls_per_month.
  │        Returns 429 with {calls_used, calls_limit, resets_at}.
  │
  └─ 3. Token cap (passed to OpenRouter as max_tokens per prompt type)
           Stored on Prompt row; streaming.py passes it through.
```

Alternatives considered:
- **Middleware-only quota**: too blunt — quota check needs user + plan context which
  middleware doesn't have cheaply.
- **Redis rate limiting**: correct long-term but adds an infra dep for v1; in-memory
  with a short TTL is sufficient until multi-instance deploy.

---

## Data Model Changes

### `usage_events` — add three columns

```sql
ALTER TABLE usage_events
  ADD COLUMN problem_id   UUID REFERENCES problems(id) ON DELETE SET NULL,
  ADD COLUMN input_tokens  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
```

`tokens_used` becomes the sum (`input_tokens + output_tokens`) for backward
compatibility; the split is needed for accurate cost computation (input ≠ output price).

### `prompts` — add `max_tokens`

```sql
ALTER TABLE prompts ADD COLUMN max_tokens INTEGER;
```

`NULL` means use OpenRouter's default. Seeded values:

| Prompt | max_tokens |
|---|---|
| code_review | 1200 |
| hint | 400 |
| solution | 800 |
| teach | 800 |
| chat | 600 |
| surprise_me | 500 |

### New config file: `backend/config/model_pricing.yaml`

```yaml
# USD per 1 000 tokens (input / output)
anthropic/claude-sonnet-4-5:
  input:  0.003
  output: 0.015
openai/gpt-4o:
  input:  0.005
  output: 0.015
google/gemini-2.0-flash:
  input:  0.00035
  output: 0.00105
meta-llama/llama-3.3-70b:
  input:  0.00059
  output: 0.00079
_default:
  input:  0.003
  output: 0.015
```

Used by a `compute_cost(model, input_tokens, output_tokens)` helper in `llm/pricing.py`
as a fallback when OpenRouter doesn't return cost metadata.

---

## Backend Components

### `llm/quota.py` — quota dependency

```python
async def require_quota(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuotaStatus:
    """FastAPI dependency. Raises HTTP 429 if monthly quota exceeded."""
```

`QuotaStatus` contains `calls_used`, `calls_limit`, `pct_used`, `resets_at`.

Logic:
1. Resolve user's active plan (via `subscription_id` or Free fallback).
2. Count `usage_events` where `user_id = user.id` and `created_at >= period_start`.
   Period start = first day of current UTC month.
3. If `calls_used >= calls_limit` → raise `HTTP 429` with body:
   ```json
   {"detail": "Monthly AI call limit reached", "calls_used": 50,
    "calls_limit": 50, "resets_at": "2026-06-01T00:00:00Z"}
   ```
4. Return `QuotaStatus` for downstream use (e.g., include in SSE done event).

Applied to: `POST /execute` (no — not LLM), `POST /submissions/{id}/review`,
`POST /problems/{id}/hint`, `POST /problems/{id}/solution`,
`POST /problems/{id}/teach`, `POST /problems/{id}/chat`,
`POST /problems/surprise-me`, `POST /llm/stream`.

### `llm/rate_limit.py` — per-minute limiter

Simple in-process sliding-window counter keyed by `user_id`.

```python
RateLimitConfig = {
    "free":  {"calls": 10, "window_seconds": 60},
    "pro":   {"calls": 30, "window_seconds": 60},
}
```

Raises `HTTP 429` with `Retry-After` header when exceeded. Applied via the same
`require_quota` dependency (co-located check, not a separate middleware).

### `llm/pricing.py` — cost fallback

```python
def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return USD cost from config/model_pricing.yaml."""
```

Called in `stream_llm_to_sse` when `usage_meta` is absent or `cost == 0`.

### `streaming.py` — enriched logging

`stream_llm_to_sse` gains two new optional parameters:

```python
async def stream_llm_to_sse(
    *,
    model: str,
    messages: list[dict],
    problem_id: uuid.UUID | None = None,   # new
    max_tokens: int | None = None,         # new — forwarded to OpenRouter
    on_complete: Callable | None = None,
) -> AsyncIterator[str]:
```

The SSE `done` event gains a `quota_warning` field:

```json
{
  "type": "done",
  "tokens_used": 312,
  "cost_usd": 0.0047,
  "quota_warning": true,   // present + true when calls_used >= 0.8 * calls_limit
  "calls_remaining": 10
}
```

### `GET /users/me/usage` — new endpoint in `api/users.py`

Response schema:

```json
{
  "calls_used": 23,
  "calls_limit": 50,
  "cost_usd_month": 0.34,
  "resets_at": "2026-06-01T00:00:00Z",
  "breakdown": {
    "code_review": 10,
    "hint": 8,
    "teach": 3,
    "solution": 1,
    "chat": 1
  }
}
```

Breakdown keyed by `prompt_name` from `usage_events`.

### `GET /admin/usage` — new endpoint in `api/admin.py`

Protected by `require_admin` dependency (checks `user.is_admin` flag on `User` model).

Query params: `from_date`, `to_date` (default: current month).

Response:

```json
{
  "total_calls": 1420,
  "total_cost_usd": 4.87,
  "by_model": {"anthropic/claude-sonnet-4-5": {"calls": 900, "cost_usd": 4.05}, ...},
  "by_feature": {"code_review": 600, "hint": 520, ...},
  "top_users": [{"user_id": "...", "calls": 48, "cost_usd": 0.43}, ...]
}
```

---

## Frontend Changes

### Settings page — usage meter

Below the profile form, add an **AI Usage** card:

```
AI Usage (this month)
[███████░░░░░░░░░░░]  23 / 50 calls used
Cost this month: $0.34
Resets June 1, 2026

Breakdown:
  Code Review   ████  10
  Hints         ████   8
  Teach          ██    3
```

Data fetched from `GET /users/me/usage`. Show a yellow `Approaching limit` badge when
>80 %, red `Limit reached` badge when at 100 %.

### Practice IDE — quota counter

Subtle pill in the IDE header (next to the language badge):

```
[python]  [23/50 AI calls]
```

Clicking it opens the Settings usage card. When quota is exhausted, AI panel tabs
(Review, Hints, etc.) show a locked state with a "Upgrade to Pro" CTA rather than
silently failing.

### Toast on quota warning

When the SSE `done` event carries `quota_warning: true`, show a dismissible toast:
> "You've used 80 % of your monthly AI calls. [Upgrade to Pro →]"

Shown at most once per session.

---

## Error Handling

| Scenario | HTTP Status | User-facing message |
|---|---|---|
| Monthly quota exceeded | 429 | "You've reached your 50-call monthly limit. Resets June 1." |
| Per-minute rate limit | 429 | "Slow down — you've made too many requests. Try again in X seconds." |
| OpenRouter 5xx | 502 | "AI service unavailable. Try again shortly." |
| Prompt not found | 404 | (internal — should never reach user) |

---

## Testing Plan

- **Unit**: `test_quota.py` — mock `usage_events` count at 0, 40, 50, 51 calls; assert 200 / 200 / 429 / 429.
- **Unit**: `test_pricing.py` — known model + token count returns expected cost; unknown model uses `_default`.
- **Unit**: `test_rate_limit.py` — 10 calls within 60 s → 11th is 429.
- **Integration**: `test_usage_endpoint.py` — logs two events, `GET /users/me/usage` returns correct counts and cost.
- **Integration**: `test_admin_usage.py` — admin user gets aggregate; non-admin gets 403.

---

## Migration Path

1. Alembic migration: add `problem_id`, `input_tokens`, `output_tokens` to `usage_events`; add `max_tokens` to `prompts`; add `is_admin BOOLEAN NOT NULL DEFAULT FALSE` to `users`.
2. Update `seeds/prompts.py` to set `max_tokens` on existing prompts.
3. Add `config/model_pricing.yaml`.
4. Implement `llm/pricing.py`, `llm/quota.py`, `llm/rate_limit.py`.
5. Wire `require_quota` dependency onto all LLM endpoints.
6. Update `stream_llm_to_sse` to accept `problem_id` and `max_tokens`.
7. Add `GET /users/me/usage` and `GET /admin/usage`.
8. Frontend: settings usage card → practice IDE counter → quota-exceeded locked state → toast.
9. Tests.

---

## Open Questions

1. Should the per-minute rate limit share the quota counter (same 429 response body)
   or return a distinct `Retry-After` style response? Recommend distinct — rate limit
   errors are transient, quota errors are not.
2. Is `user.is_admin` flag sufficient for admin auth, or do we want a role table?
   For v1, a boolean flag on `User` is fine.
3. Do we want to count cached/stored responses (e.g., `stream_static_to_sse`) against
   quota? Recommend no — only real LLM calls count.
