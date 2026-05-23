# Control Flow Audit — CodeMentor
**Date:** 2026-05-22  
**Reviewer perspective:** Senior engineering manager  
**Scope:** Backend API + frontend data flow across dashboard, learning paths, and practice IDE

---

## Executive Summary

The system works end-to-end, but there are nine control flow issues across three categories — data divergence, performance waste, and maintainability debt. None is a user-facing blocker today, but three of them (issues 1–3) are correctness risks that will produce confusing experiences as the user base grows. The rest are performance and hygiene issues worth addressing before the next milestone.

---

## Issue Inventory

### CRITICAL — Data correctness

#### Issue 1: Dual learning path sources of truth

**Where:** `backend/api/dashboard.py:87–88`, `backend/core/learning_path.py:118–136`

**What happens:**  
`GET /dashboard/me` calls `fetch_ranked_candidates` + `build_learning_path` to compute the user's learning path on the fly. This is an ephemeral, in-memory recomputation that ignores the persisted `LearningPath` table.

Meanwhile, `GET /learning-paths` returns the *persisted* personalized path — the canonical record. These two code paths can return different problems for the same user because the DB record is only regenerated when onboarding fields change, while `dashboard.py` recalculates on every request.

**Risk:** The dashboard and the learn page show different "your path" lists. A user following the dashboard card will practice different problems than if they go via `/learn`.

**Fix:**  
`GET /dashboard/me` should call `ensure_personalized_path` + `path_problems_ordered` (same logic as `personalized_path_response`) instead of recomputing from candidates. Delete the direct `fetch_ranked_candidates` call from `dashboard.py`.

---

#### Issue 2: `/dashboard/me` endpoint is dead code

**Where:** `backend/api/dashboard.py`, `frontend/app/dashboard/page.tsx:62–70`

**What happens:**  
The dashboard page makes 5–6 parallel `apiFetch` calls:
- `GET /users/me`
- `GET /submissions/me?limit=5`
- `GET /learning-paths`
- `GET /submissions/me/problem-ids`
- `GET /problems/facets`
- Then: `GET /learning-paths/{id}/problems`

The `GET /dashboard/me` endpoint in `dashboard.py` was built to consolidate this into one round trip, but the frontend was never wired to it. The endpoint now computes a divergent learning path (see Issue 1) and returns a subset of what the frontend actually needs. It's dead weight.

**Risk:** Performance overhead (6 serial/parallel trips on every dashboard load). The endpoint's own computed learning path becomes a maintenance trap — it diverges silently.

**Fix (two options):**  
- **Option A (preferred):** Update `GET /dashboard/me` to use the persisted path and return all fields the frontend needs, including facets and path problems. Wire the frontend to a single `GET /dashboard/me` call.
- **Option B:** Remove `GET /dashboard/me` entirely and accept the 6-call fan-out as explicit (it's at least honest about what it's doing). Document the fan-out and move on.

---

#### Issue 3: Deprecated endpoint still on the hot path

**Where:** `backend/api/users.py:52–68` (marked `"""Deprecated for new frontend…"""`), `frontend/app/practice/[id]/page.tsx:170`

**What happens:**  
When the practice page loads without a `pathId` in the URL or session storage, it falls back to `GET /users/me/learning-path` — the deprecated endpoint. The endpoint still runs `personalized_path_response` which includes a `fetch_ranked_candidates` call (see Issue 1 pattern). It works, but it returns a different shape than the new `GET /learning-paths/{id}/problems` and bypasses the persisted path.

**Risk:** Users who reach `/practice/{id}` directly (e.g., from a search or external link) get the old ephemeral path instead of their canonical persisted path. The "Next problem" button navigates incorrectly for these users.

**Fix:**  
Replace the fallback in `practice/[id]/page.tsx` with a call to `GET /learning-paths` to find the user's personalized path, then fetch its problems. Remove the `/users/me/learning-path` fallback entirely. Once the frontend no longer calls the deprecated endpoint, schedule its removal from the backend.

---

### HIGH — Performance

#### Issue 4: N+1 queries in `list_learning_paths`

**Where:** `backend/api/learning_paths.py:36–58` (`_make_path_out`), `backend/api/learning_paths.py:87–111`

**What happens:**  
`list_learning_paths` fetches all paths, then calls `_make_path_out` for each one. Each `_make_path_out` call runs a separate `db.query(LearningPathProblem.problem_id)` to count problems in that path. With N paths, that's N+1 database round trips.

Additionally, `_make_path_out` runs another `db.query(LearningPathProblem)` inside `list_path_problems` when called separately — slightly different from the counting query but touching the same table.

**Fix:**  
Replace per-path queries with a single aggregation:
```python
from sqlalchemy import func

counts = (
    db.query(
        LearningPathProblem.learning_path_id,
        func.count().label("total"),
        func.count(
            case((LearningPathProblem.problem_id.in_(solved_ids), 1))
        ).label("solved"),
    )
    .filter(LearningPathProblem.learning_path_id.in_([p.id for p in paths]))
    .group_by(LearningPathProblem.learning_path_id)
    .all()
)
```
Build a `{path_id: (solved, total)}` dict and use it to construct all `LearningPathOut` objects without further queries.

---

#### Issue 5: Unused `problemList` fetch in path mode

**Where:** `frontend/app/practice/[id]/page.tsx:178`

**What happens:**  
`GET /problems?page_size=20` is always fetched in parallel during page load — regardless of whether the user is in path mode. When `learningPath.length > 0`, `sidebarProblems` uses `learningPath` and ignores `problemList` entirely. The 20-problem fetch is discarded.

**Fix:**  
Conditionally skip the problems list fetch when a path is being loaded:
```typescript
const listFetch = pathId
  ? Promise.resolve({ items: [] as ProblemListItem[] })
  : apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token });
```

---

#### Issue 6: Token re-validated on every AI action

**Where:** `frontend/app/practice/[id]/page.tsx` — `getToken()` called in every handler

**What happens:**  
`getToken()` creates a `createClient()` instance and calls `getValidatedAccessToken(supabase)` (which hits the Supabase network) for every user action: `handleSubmit`, `handleRun`, `handleRunWithStdin`, `handleHint`, `handleSolution`, `handleCodeReview`, `handleChat`. In a busy session, that's 7+ redundant token validations.

**Fix:**  
Store the token in a `ref` after the initial load. Re-validate only on 401 responses (or on a timer if the session is long-lived). Example:
```typescript
const tokenRef = useRef<string | null>(null);

// in load():
tokenRef.current = token;

// in handlers:
const token = tokenRef.current;
if (!token) { router.replace("/login"); return; }
```
On 401, clear `tokenRef.current`, call `getToken()` again, and retry.

---

### MEDIUM — Maintainability

#### Issue 7: `EXPERIENCE_MESSAGES` duplicated across stack

**Where:** `backend/core/learning_path.py:36–41`, `frontend/lib/learning-path-utils.ts`

**What happens:**  
The four experience-level messages are defined identically in both the Python backend and the TypeScript frontend. Any copy change requires editing two files. Currently in sync, but this will drift.

**Fix:**  
Serve `EXPERIENCE_MESSAGES` from the API — either as part of the `/users/me/learning-path` response (already included as `message`) or as a static `GET /config/messages` endpoint. The frontend should consume it rather than redefine it. In the short term, add a comment in both files referencing the other location.

---

#### Issue 8: `LearningPathProblem` schema defined twice in backend

**Where:** `backend/api/dashboard.py:22–34`, `backend/schemas/learning_path.py`

**What happens:**  
`dashboard.py` defines a local `LearningPathProblem` Pydantic model (with a `_strip_title` field validator) at module scope. `schemas/learning_path.py` defines `LearningPathProblemItem` for the same concept. Both are used in production paths.

**Risk:** If strip-title logic is updated in one place, the other silently diverges. Two models that look the same but behave differently create refactoring confusion.

**Fix:**  
Move the `_strip_title` validator into `LearningPathProblemItem` in `schemas/learning_path.py` and delete the local class in `dashboard.py`. One schema, one strip-title implementation.

---

#### Issue 9: Side effect in a GET endpoint

**Where:** `backend/api/learning_paths.py:93` — `ensure_personalized_path(db, current_user)` called at the top of `GET /learning-paths`

**What happens:**  
`ensure_personalized_path` may create a new `LearningPath` row and write `LearningPathProblem` rows to the database. This is a write operation inside a GET handler. REST convention says GET is idempotent and side-effect-free. Some caching layers (CDNs, reverse proxies) will assume this.

**Risk:** Caching `GET /learning-paths` at any layer (even `stale-while-revalidate` in the browser) could serve a cached empty list before the first write fires, then show the path on next load — confusing race condition.

**Fix:**  
Move personalized path creation to the profile-complete moment (`PATCH /users/me` already calls `regenerate_personalized_path` when onboarding fields change — that's correct). Remove `ensure_personalized_path` from `GET /learning-paths`. If the path is missing, return what exists; the onboarding wizard is responsible for seeding it. Alternatively, expose a `POST /learning-paths/personalized/sync` endpoint the frontend can call explicitly after onboarding.

---

## Recommended Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Issue 1: Dual path sources | Medium | High — data correctness |
| 2 | Issue 3: Deprecated endpoint fallback | Low | High — wrong next-problem navigation |
| 3 | Issue 9: GET side effect | Low | Medium — correctness + caching |
| 4 | Issue 2: Dead dashboard endpoint | High | Medium — remove tech debt |
| 5 | Issue 4: N+1 queries | Medium | Medium — DB load |
| 6 | Issue 6: Token re-validation | Low | Low-Medium — latency |
| 7 | Issue 5: Unused problemList fetch | Low | Low — one extra request |
| 8 | Issue 8: Duplicate schema | Low | Low — maintainability |
| 9 | Issue 7: Duplicated EXPERIENCE_MESSAGES | Low | Low — maintainability |

---

## What's Working Well

- The persisted `LearningPath` + `LearningPathProblem` model is the right long-term architecture. Issues 1–3 are about the transition from the old ephemeral approach not being fully cleaned up.
- `resolvePracticePathId` correctly handles URL param → session storage fallback → validation. Clean design.
- `_assert_custom_owner` is a clean guard pattern. Consistently applied across path mutation endpoints.
- `regenerate_personalized_path` is correct and idempotent. The logic of replacing path problems atomically (delete-then-insert within a transaction) is safe.
- The streaming SSE pattern (`onToken` / `onDone` / `onError` callbacks) is well-factored and consistent across all AI tabs.
- `NextProblemButton` correctly propagates `?path=` to preserve context through navigation.
