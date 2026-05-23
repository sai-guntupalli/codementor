# Control Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 control flow issues identified in the 2026-05-22 audit: remove dead/divergent backend code, eliminate N+1 queries, fix a GET side-effect, replace a deprecated API fallback in the frontend, and tighten token and data-fetch usage in the practice IDE.

**Architecture:** Backend fixes are isolated to `dashboard.py` (deletion), `learning_paths.py` (query batching + GET side-effect), and `users.py` (ensure path on profile patch). Frontend fixes are isolated to `practice/[id]/page.tsx` (deprecated fallback, conditional fetch, token ref). Each task produces a working, testable commit.

**Tech Stack:** FastAPI, SQLAlchemy, Pytest, Next.js 15, TypeScript, Supabase

---

## File Map

| File | Action | Issues addressed |
|------|--------|-----------------|
| `backend/api/dashboard.py` | **Delete** | 1, 2, 8 |
| `backend/main.py` | Remove dashboard router import | 1, 2, 8 |
| `backend/api/learning_paths.py` | Batch progress queries; remove GET side-effect | 4, 9 |
| `backend/api/users.py` | Always call `ensure_personalized_path` in PATCH | 9 |
| `backend/tests/test_learning_paths.py` | Update lazy-init test; add batch-progress test | 4, 9 |
| `frontend/app/practice/[id]/page.tsx` | Replace deprecated fallback; conditional list fetch; token ref | 3, 5, 6 |
| `backend/core/learning_path.py` | Add cross-reference comment | 7 |
| `frontend/lib/learning-path-utils.ts` | Add cross-reference comment | 7 |

---

## Task 1: Remove dead `/dashboard/me` endpoint (Issues 1, 2, 8)

`GET /dashboard/me` recomputes the learning path ephemerally (diverges from the persisted path) and is not called by the frontend. It also holds a duplicate `LearningPathProblem` Pydantic model. Delete the file and deregister the router.

**Files:**
- Delete: `backend/api/dashboard.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Verify no tests reference the dashboard API endpoint**

```bash
cd backend && grep -r "dashboard/me\|/dashboard/me\|dashboard_router" tests/
```

Expected: no output (there are no existing tests for this endpoint).

- [ ] **Step 2: Delete `backend/api/dashboard.py`**

```bash
rm backend/api/dashboard.py
```

- [ ] **Step 3: Remove dashboard router from `backend/main.py`**

Open `backend/main.py`. Remove these two lines:

```python
# Remove this import line:
from api.dashboard import router as dashboard_router

# Remove this registration line:
app.include_router(dashboard_router)
```

After editing, `main.py` should look like:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.bookmarks import router as bookmarks_router
from api.execute import router as execute_router
from api.learning_paths import router as learning_paths_router
from api.llm import router as llm_router
from api.curriculum import router as curriculum_router
from api.health import router as health_router
from api.practice import router as practice_router
from api.problems import router as problems_router
from api.submissions import router as submissions_router
from api.users import router as users_router
from core.config import settings

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(bookmarks_router)
app.include_router(problems_router)
app.include_router(practice_router)
app.include_router(curriculum_router)
app.include_router(learning_paths_router)
app.include_router(users_router)
app.include_router(submissions_router)
app.include_router(llm_router)
app.include_router(execute_router)
```

- [ ] **Step 4: Run the full test suite to confirm nothing breaks**

```bash
cd backend && python -m pytest -x -q 2>&1 | tail -20
```

Expected: same pass count as before (currently 48+), no failures.

- [ ] **Step 5: Commit**

```bash
git add backend/api/dashboard.py backend/main.py
git commit -m "feat: remove dead /dashboard/me endpoint and duplicate LearningPathProblem schema"
```

---

## Task 2: Batch N+1 queries in `list_learning_paths` (Issue 4)

`list_learning_paths` calls `_make_path_out` once per path; each call runs a `SELECT` on `learning_path_problems`. With N paths that's N+1 queries. Replace with a single bulk query that fetches all `(path_id, problem_id)` pairs at once, computes progress per path in Python, then builds all responses.

**Files:**
- Modify: `backend/api/learning_paths.py`
- Modify: `backend/tests/test_learning_paths.py`

- [ ] **Step 1: Write a failing test for batch progress**

Add to `backend/tests/test_learning_paths.py` (after the existing `test_list_learning_paths_progress_solved` test):

```python
def test_list_learning_paths_progress_multiple_paths(
    auth_client: TestClient, db: Session, persisted_user
):
    """Batch query must compute correct progress for multiple paths simultaneously."""
    path_a = _make_custom_path(db, persisted_user.id, "Alpha")
    path_b = _make_custom_path(db, persisted_user.id, "Beta")
    p1 = _make_problem(db)
    p2 = _make_problem(db)
    p3 = _make_problem(db)
    _add_problem_to_path(db, path_a.id, p1.id)
    _add_problem_to_path(db, path_a.id, p2.id)
    _add_problem_to_path(db, path_b.id, p3.id)
    _make_solved_submission(db, persisted_user.id, p1.id)

    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    paths = {p["id"]: p for p in resp.json()}

    a = paths[str(path_a.id)]
    assert a["progress"]["total_count"] == 2
    assert a["progress"]["solved_count"] == 1
    assert a["progress"]["progress_pct"] == 50

    b = paths[str(path_b.id)]
    assert b["progress"]["total_count"] == 1
    assert b["progress"]["solved_count"] == 0
    assert b["progress"]["progress_pct"] == 0
```

- [ ] **Step 2: Run the new test to verify it passes (it tests existing behavior)**

```bash
cd backend && python -m pytest tests/test_learning_paths.py::test_list_learning_paths_progress_multiple_paths -v
```

Expected: PASS (the test documents correct behavior, not a regression).

- [ ] **Step 3: Add `_batch_path_progress` function to `backend/api/learning_paths.py`**

Add this function after the `_make_path_out` helper (around line 60), replacing its logic for the list endpoint:

```python
from collections import defaultdict


def _batch_path_progress(
    db: Session,
    path_ids: list[uuid.UUID],
    solved_ids: set[uuid.UUID],
) -> dict[uuid.UUID, LearningPathProgress]:
    """Single-query progress computation for multiple paths."""
    if not path_ids:
        return {}
    rows = (
        db.query(LearningPathProblem.learning_path_id, LearningPathProblem.problem_id)
        .filter(LearningPathProblem.learning_path_id.in_(path_ids))
        .all()
    )
    path_problems: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for path_id, problem_id in rows:
        path_problems[path_id].append(problem_id)

    result: dict[uuid.UUID, LearningPathProgress] = {}
    for pid in path_ids:
        problems = path_problems[pid]
        total = len(problems)
        solved = sum(1 for p in problems if p in solved_ids)
        pct = round(solved / total * 100) if total > 0 else 0
        result[pid] = LearningPathProgress(solved_count=solved, total_count=total, progress_pct=pct)
    return result
```

Also add the `defaultdict` import to the top of the file:

```python
from collections import defaultdict
```

- [ ] **Step 4: Update `list_learning_paths` to use `_batch_path_progress`**

Replace the current `list_learning_paths` body (lines 87–111) with:

```python
@router.get("", response_model=list[LearningPathOut])
def list_learning_paths(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[LearningPathOut]:
    """List all paths visible to the current user with per-path progress."""
    ensure_personalized_path(db, current_user)

    curated = (
        db.query(LearningPath)
        .filter(LearningPath.type == LearningPathType.curated)
        .order_by(LearningPath.sort_order.asc().nullslast())
        .all()
    )
    user_paths = (
        db.query(LearningPath)
        .filter(
            LearningPath.created_by == current_user.id,
            LearningPath.type.in_([LearningPathType.personalized, LearningPathType.custom]),
        )
        .all()
    )

    all_paths = curated + user_paths
    solved_ids = _get_solved_ids(db, current_user.id)
    progress_map = _batch_path_progress(db, [p.id for p in all_paths], solved_ids)

    return [
        LearningPathOut(
            id=path.id,
            title=path.title,
            description=path.description,
            type=path.type.value,
            created_by=path.created_by,
            is_public=path.is_public,
            sort_order=path.sort_order,
            created_at=path.created_at,
            progress=progress_map.get(
                path.id, LearningPathProgress(solved_count=0, total_count=0, progress_pct=0)
            ),
        )
        for path in all_paths
    ]
```

- [ ] **Step 5: Run all learning path tests**

```bash
cd backend && python -m pytest tests/test_learning_paths.py -v 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/api/learning_paths.py backend/tests/test_learning_paths.py
git commit -m "perf: batch learning path progress queries (N+1 → 1)"
```

---

## Task 3: Remove GET side-effect from `list_learning_paths` (Issue 9)

`GET /learning-paths` calls `ensure_personalized_path` which may write to the DB — a side-effect inside a GET handler. Move path initialization to `PATCH /users/me`, which already calls `regenerate_personalized_path` when onboarding fields change. After this fix, `GET /learning-paths` is read-only.

**Files:**
- Modify: `backend/api/learning_paths.py`
- Modify: `backend/api/users.py`
- Modify: `backend/tests/test_learning_paths.py`

- [ ] **Step 1: Update `test_list_learning_paths_creates_personalized_lazily` to reflect new behavior**

This test currently asserts that `GET /learning-paths` creates the personalized path. After the fix, path creation happens on `PATCH /users/me`. Update the test:

Find `test_list_learning_paths_creates_personalized_lazily` in `test_learning_paths.py` and replace it:

```python
def test_patch_profile_creates_personalized_path(
    auth_client: TestClient, db: Session, persisted_user
):
    """PATCH /users/me with onboarding data creates the personalized path; GET sees it."""
    for i in range(5):
        db.add(
            Problem(
                title=f"Init {i}",
                description="x" * 20,
                difficulty="beginner",
                language="python",
                source="curated",
                is_published=True,
                sort_order=i,
            )
        )
    db.commit()

    auth_client.patch(
        "/users/me",
        json={"coding_experience": "none", "learning_goal": "fun", "interested_topics": []},
    )

    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    personalized = [p for p in resp.json() if p["type"] == "personalized"]
    assert len(personalized) == 1
    assert personalized[0]["progress"]["total_count"] >= 1


def test_get_learning_paths_does_not_create_path_when_none_exists(
    auth_client: TestClient, db: Session
):
    """GET /learning-paths must not write to DB — no personalized path created without PATCH."""
    resp = auth_client.get("/learning-paths")
    assert resp.status_code == 200
    personalized = [p for p in resp.json() if p["type"] == "personalized"]
    assert len(personalized) == 0
```

- [ ] **Step 2: Run the new tests to see them fail (they will, since GET still creates the path)**

```bash
cd backend && python -m pytest tests/test_learning_paths.py::test_get_learning_paths_does_not_create_path_when_none_exists -v
```

Expected: FAIL — the test asserts no personalized path, but `ensure_personalized_path` in GET creates one.

- [ ] **Step 3: Remove `ensure_personalized_path` from `list_learning_paths` in `learning_paths.py`**

In `list_learning_paths`, delete this line:

```python
ensure_personalized_path(db, current_user)
```

Also remove the import `from core.learning_path import ensure_personalized_path` from the imports block, since it's no longer used in this file.

The updated imports block at top of `learning_paths.py`:

```python
import uuid
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.learning import LearningPath, LearningPathProblem, LearningPathType, Problem, Submission
from models.users import User
from schemas.learning_path import (
    AddProblemBody,
    LearningPathCreate,
    LearningPathOut,
    LearningPathProblemItem,
    LearningPathProgress,
    LearningPathUpdate,
)
```

- [ ] **Step 4: Update `PATCH /users/me` to always ensure path exists**

In `backend/api/users.py`, find the `update_me` function. Currently:

```python
if should_regen and user.coding_experience is not None:
    regenerate_personalized_path(db, user)
```

Replace with:

```python
if should_regen and user.coding_experience is not None:
    regenerate_personalized_path(db, user)
elif user.coding_experience is not None:
    ensure_personalized_path(db, user)
```

Also update the imports in `users.py` to include `ensure_personalized_path`:

```python
from core.learning_path import (
    EXPERIENCE_MESSAGES,
    ensure_personalized_path,
    personalized_path_response,
    regenerate_personalized_path,
)
```

- [ ] **Step 5: Run the failing test — it should now pass**

```bash
cd backend && python -m pytest tests/test_learning_paths.py::test_get_learning_paths_does_not_create_path_when_none_exists tests/test_learning_paths.py::test_patch_profile_creates_personalized_path -v
```

Expected: both PASS.

- [ ] **Step 6: Run the full test suite**

```bash
cd backend && python -m pytest -x -q 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/api/learning_paths.py backend/api/users.py backend/tests/test_learning_paths.py
git commit -m "fix: remove DB write from GET /learning-paths; ensure path on PATCH /users/me"
```

---

## Task 4: Replace deprecated fallback in practice page (Issue 3)

`practice/[id]/page.tsx` falls back to `GET /users/me/learning-path` (marked deprecated in the backend) when no `pathId` is in the URL. Replace with a call to `GET /learning-paths` to find the personalized path, then fetch its problems — matching the canonical data source.

**Files:**
- Modify: `frontend/app/practice/[id]/page.tsx`

- [ ] **Step 1: Add `LearningPathListItem` to the imports in `practice/[id]/page.tsx`**

The file already imports from `@/lib/api`. Add `LearningPathListItem` to the import:

```typescript
import {
  apiFetch,
  type LearningPathListItem,      // ← add this
  type LearningPathOut,
  type LearningPathProblem,
  type LearningPathProblemItem,
  type SolvedProblemIdsOut,
  type SubmissionOut,
} from "@/lib/api";
```

Also add `pickActiveLearningPath` to the import from `@/lib/learning-path-utils`:

```typescript
import {
  pickActiveLearningPath,          // ← add this
} from "@/lib/learning-path-utils";
```

- [ ] **Step 2: Replace the `pathFetch` logic in the `load()` function**

Find this block in the `useEffect` load function (around line 162–174):

```typescript
const pathFetch = pathId
  ? apiFetch<LearningPathProblemItem[]>(
      `/learning-paths/${pathId}/problems`,
      { token }
    )
      .then((items) => ({ problems: items as LearningPathProblem[] }))
      .catch(() => ({ problems: [] as LearningPathProblem[] }))
  : apiFetch<LearningPathOut>("/users/me/learning-path", { token }).catch(() => ({
      problems: [] as LearningPathProblem[],
      next_problems: [] as LearningPathProblem[],
      message: "",
    }));
```

Replace it with:

```typescript
const pathFetch: Promise<{ problems: LearningPathProblem[]; resolvedId?: string }> = pathId
  ? apiFetch<LearningPathProblemItem[]>(
      `/learning-paths/${pathId}/problems`,
      { token }
    )
      .then((items) => ({ problems: items as LearningPathProblem[], resolvedId: pathId }))
      .catch(() => ({ problems: [] as LearningPathProblem[] }))
  : apiFetch<LearningPathListItem[]>("/learning-paths", { token })
      .then(async (paths) => {
        const active = pickActiveLearningPath(paths);
        if (!active) return { problems: [] as LearningPathProblem[] };
        const items = await apiFetch<LearningPathProblemItem[]>(
          `/learning-paths/${active.id}/problems`,
          { token }
        ).catch(() => [] as LearningPathProblemItem[]);
        return { problems: items as LearningPathProblem[], resolvedId: active.id };
      })
      .catch(() => ({ problems: [] as LearningPathProblem[] }));
```

- [ ] **Step 3: Update `setLearningPath` and `setResolvedPathId` to use the new shape**

Find the `Promise.all` destructure (around line 176):

```typescript
const [p, list, solved, path] = await Promise.all([
  apiFetch<Problem>(`/problems/${id}`, { token }),
  apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token }),
  apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }).catch(
    () => ({ solved_ids: [] as string[] })
  ),
  pathFetch,
]);
setProblem(p);
setProblemList(list.items);
setSolvedIds(new Set(solved.solved_ids));
setLearningPath(path.problems);
```

Update the `setLearningPath` line and add `setResolvedPathId` update:

```typescript
const [p, list, solved, path] = await Promise.all([
  apiFetch<Problem>(`/problems/${id}`, { token }),
  apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token }),
  apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }).catch(
    () => ({ solved_ids: [] as string[] })
  ),
  pathFetch,
]);
setProblem(p);
setProblemList(list.items);
setSolvedIds(new Set(solved.solved_ids));
setLearningPath(path.problems);
if (path.resolvedId && !pathId) {
  setResolvedPathId(path.resolvedId);
}
```

- [ ] **Step 4: Remove the now-unused `LearningPathOut` type from imports**

`LearningPathOut` was only used by the deprecated fallback. Remove it from the `apiFetch` import line:

```typescript
import {
  apiFetch,
  type LearningPathListItem,
  type LearningPathProblem,
  type LearningPathProblemItem,
  type SolvedProblemIdsOut,
  type SubmissionOut,
} from "@/lib/api";
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `practice/[id]/page.tsx`.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/practice/[id]/page.tsx
git commit -m "fix: replace deprecated /users/me/learning-path fallback with /learning-paths lookup"
```

---

## Task 5: Skip `problemList` fetch in path mode (Issue 5)

When `pathId` is present (or will be resolved from a path), `sidebarProblems` ignores `problemList` entirely. Avoid the `GET /problems?page_size=20` request when a path context is available.

**Files:**
- Modify: `frontend/app/practice/[id]/page.tsx`

- [ ] **Step 1: Wrap the `problemList` fetch in a conditional**

Find the `Promise.all` block (now updated from Task 4). Change the `list` fetch:

```typescript
const [p, list, solved, path] = await Promise.all([
  apiFetch<Problem>(`/problems/${id}`, { token }),
  apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token }),
  apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }).catch(
    () => ({ solved_ids: [] as string[] })
  ),
  pathFetch,
]);
```

Replace with:

```typescript
const listFetch = pathId
  ? Promise.resolve({ items: [] as ProblemListItem[] })
  : apiFetch<{ items: ProblemListItem[] }>("/problems?page_size=20", { token }).catch(
      () => ({ items: [] as ProblemListItem[] })
    );

const [p, list, solved, path] = await Promise.all([
  apiFetch<Problem>(`/problems/${id}`, { token }),
  listFetch,
  apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }).catch(
    () => ({ solved_ids: [] as string[] })
  ),
  pathFetch,
]);
```

Note: when `pathId` is provided, `path.problems` will be non-empty, so `sidebarProblems` will use that and `list.items` (empty) is harmlessly ignored.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/practice/[id]/page.tsx
git commit -m "perf: skip /problems fetch in practice page when path context is present"
```

---

## Task 6: Cache auth token in `useRef` (Issue 6)

Every AI action handler (`handleSubmit`, `handleRun`, `handleRunWithStdin`, `handleHint`, `handleSolution`, `handleCodeReview`, `handleChat`) calls `getToken()`, which creates a Supabase client and reads the session. Cache the token in a ref after the initial load and reuse it.

Note: `getValidatedAccessToken` reads from local storage via `supabase.auth.getSession()` — no network call. The overhead is creating a `createClient()` on each call. This fix eliminates 7+ redundant client instantiations per session.

**Files:**
- Modify: `frontend/app/practice/[id]/page.tsx`

- [ ] **Step 1: Add a `tokenRef` declaration near the other refs**

After the existing `useState` declarations near the top of `PracticePage`, add:

```typescript
const tokenRef = useRef<string | null>(null);
```

Make sure `useRef` is already in the React import at the top:
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```
(It should already be there from the existing `useCallback` import chain.)

- [ ] **Step 2: Store the token in the ref inside `load()`**

In the `load()` function inside the main `useEffect`, find:

```typescript
const token = await getToken();
if (!token || !id) return;
```

Add the ref assignment after:

```typescript
const token = await getToken();
if (!token || !id) return;
tokenRef.current = token;
```

- [ ] **Step 3: Replace `getToken()` calls in all handlers with `tokenRef.current`**

Each handler currently does:
```typescript
const token = await getToken();
if (!token) return;
```

Replace every instance of that pattern with:
```typescript
const token = tokenRef.current ?? await getToken();
if (!token) { router.replace("/login"); return; }
```

The handlers to update: `handleRun`, `handleRunWithStdin`, `handleSubmit`, `handleHint`, `handleSolution`, `handleCodeReview`, `handleChat`. There are 7 occurrences.

For `handleRun` (find the pattern and replace):
```typescript
async function handleRun() {
  if (!problem || !code.trim()) return;
  setRunning(true);
  setOutputOpen(true);
  setTestResults([]);
  setRunOnceResult(null);
  if (!runStdin.trim()) setRunStdin(defaultStdinFromExamples());
  try {
    const token = tokenRef.current ?? await getToken();
    if (!token) { router.replace("/login"); return; }
    const results = await runTestCases(problem.language, code, token, problem.examples);
    setTestResults(results);
  } finally {
    setRunning(false);
  }
}
```

For `handleRunWithStdin`:
```typescript
async function handleRunWithStdin() {
  if (!problem || !code.trim()) return;
  setRunning(true);
  setOutputOpen(true);
  setTestResults([]);
  setRunOnceResult(null);
  try {
    const token = tokenRef.current ?? await getToken();
    if (!token) { router.replace("/login"); return; }
    const result = await runCode(
      problem.language,
      code,
      token,
      normalizeStdin(runStdin)
    );
    setRunOnceResult(result);
  } catch (err) {
    setRunOnceResult({
      stdout: "",
      stderr: err instanceof Error ? err.message : "Execution failed",
      exit_code: 1,
      timed_out: false,
    });
  } finally {
    setRunning(false);
  }
}
```

For `handleSubmit` — find the `const token = await getToken();` inside it and replace:
```typescript
const token = tokenRef.current ?? await getToken();
if (!token) {
  setStreaming(false);
  return;
}
```

For `handleHint`:
```typescript
const token = tokenRef.current ?? await getToken();
if (!token) return;
```

For `handleSolution`:
```typescript
const token = tokenRef.current ?? await getToken();
if (!token) return;
```

For `handleCodeReview`:
```typescript
const token = tokenRef.current ?? await getToken();
if (!token) return;
```

For `handleChat`:
```typescript
const token = tokenRef.current ?? await getToken();
if (!token) return;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/practice/[id]/page.tsx
git commit -m "perf: cache auth token in ref to avoid redundant client instantiation per action"
```

---

## Task 7: Cross-reference duplicated `EXPERIENCE_MESSAGES` (Issue 7)

`EXPERIENCE_MESSAGES` is defined independently in both Python and TypeScript. Since exposing it from an API endpoint would be a larger refactor, add cross-reference comments to both files to prevent silent drift.

**Files:**
- Modify: `backend/core/learning_path.py`
- Modify: `frontend/lib/learning-path-utils.ts`

- [ ] **Step 1: Add cross-reference comment in `backend/core/learning_path.py`**

Find (around line 36):
```python
EXPERIENCE_MESSAGES: dict[str, str] = {
    "none": "Here's your beginner-friendly path — no prior experience needed.",
    "some": "Problems selected to build on what you already know.",
    "comfortable": "A mix of easy and medium problems to sharpen your skills.",
    "professional": "Challenging problems to level up your interview readiness.",
}
```

Replace with:
```python
# Mirrored in frontend/lib/learning-path-utils.ts — keep both in sync.
EXPERIENCE_MESSAGES: dict[str, str] = {
    "none": "Here's your beginner-friendly path — no prior experience needed.",
    "some": "Problems selected to build on what you already know.",
    "comfortable": "A mix of easy and medium problems to sharpen your skills.",
    "professional": "Challenging problems to level up your interview readiness.",
}
```

- [ ] **Step 2: Add cross-reference comment in `frontend/lib/learning-path-utils.ts`**

Find (around line 53):
```typescript
export const EXPERIENCE_MESSAGES: Record<string, string> = {
  none: "Beginner-friendly problems — no prior experience needed.",
  some: "Build on what you already know.",
  comfortable: "Easy and medium problems to sharpen your skills.",
  professional: "Challenging problems for interview readiness.",
};
```

Replace with:
```typescript
// Mirrored in backend/core/learning_path.py — keep both in sync.
// Note: these strings differ slightly from the backend copy (shorter phrasing).
// TODO: serve from API to eliminate duplication.
export const EXPERIENCE_MESSAGES: Record<string, string> = {
  none: "Beginner-friendly problems — no prior experience needed.",
  some: "Build on what you already know.",
  comfortable: "Easy and medium problems to sharpen your skills.",
  professional: "Challenging problems for interview readiness.",
};
```

- [ ] **Step 3: Run backend tests to confirm no regressions**

```bash
cd backend && python -m pytest -x -q 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/core/learning_path.py frontend/lib/learning-path-utils.ts
git commit -m "chore: cross-reference duplicated EXPERIENCE_MESSAGES between backend and frontend"
```

---

## Task 8: Final verification and PR

- [ ] **Step 1: Run the full backend test suite**

```bash
cd backend && python -m pytest -v 2>&1 | tail -40
```

Expected: all tests pass. Count should be ≥ the pre-fix count (likely higher due to new tests added in Tasks 2 and 3).

- [ ] **Step 2: Run the TypeScript build to confirm no type errors**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 3: Build the frontend**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 4: Update PROGRESS.md**

Add to the Completed section:

```markdown
- [2026-05-22] Control flow audit fixes
  - Removed dead `/dashboard/me` endpoint and duplicate `LearningPathProblem` schema
  - Batched N+1 queries in `GET /learning-paths` (N+1 → 1 query)
  - Removed DB write side-effect from `GET /learning-paths`; path now created in `PATCH /users/me`
  - Replaced deprecated `/users/me/learning-path` fallback in practice page with `/learning-paths` lookup
  - Skipped `GET /problems?page_size=20` in practice page when path context is present
  - Cached auth token in `useRef` to avoid redundant client instantiation
  - Cross-referenced duplicated `EXPERIENCE_MESSAGES` in both stacks
```

- [ ] **Step 5: Open PR**

```bash
gh pr create \
  --title "fix: control flow audit — remove dead endpoints, batch queries, fix deprecated fallback" \
  --body "$(cat <<'EOF'
## Summary
- Removes dead `/dashboard/me` endpoint (divergent path logic + duplicate schema)
- Batches N+1 queries in `GET /learning-paths` — one SQL query for all path progress
- Moves `ensure_personalized_path` write out of GET handler into `PATCH /users/me`
- Replaces deprecated `/users/me/learning-path` fallback in practice page with canonical `/learning-paths` lookup
- Skips unused `GET /problems` fetch in practice page when in path mode
- Caches auth token in ref to avoid 7+ redundant Supabase client instantiations per session
- Adds cross-reference comments to duplicated `EXPERIENCE_MESSAGES`

## Test plan
- [ ] All backend tests pass (`make test`)
- [ ] Frontend build passes (`cd frontend && npm run build`)
- [ ] Navigate to `/practice/{id}` directly (no path in URL) — sidebar shows learning path problems
- [ ] Navigate to `/practice/{id}?path={pathId}` — next-problem button stays in path
- [ ] Visit `/learn` — all paths show correct progress counts
- [ ] Submit code on practice page — no extra Supabase client warnings in console

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Issue → Task Mapping

| Issue | Task | Status |
|-------|------|--------|
| 1. Divergent path in dashboard.py | Task 1 (delete endpoint) | — |
| 2. Dead /dashboard/me endpoint | Task 1 (delete endpoint) | — |
| 3. Deprecated endpoint fallback | Task 4 | — |
| 4. N+1 queries | Task 2 | — |
| 5. Wasteful problemList fetch | Task 5 | — |
| 6. Token re-validation | Task 6 | — |
| 7. EXPERIENCE_MESSAGES duplication | Task 7 | — |
| 8. Duplicate LearningPathProblem schema | Task 1 (delete endpoint) | — |
| 9. GET side-effect | Task 3 | — |
