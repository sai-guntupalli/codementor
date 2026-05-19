# Core UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve usability across the practice loop — solved indicators on the problems list, personalized recommendations on the dashboard, a real Learn page, code autosave in the practice IDE, and a post-review CTA after the AI review completes.

**Architecture:** One new backend endpoint (`GET /submissions/me/problem-ids`) returns a lightweight list of problem UUIDs the user has submitted. The frontend fetches this once per page and builds a client-side `Set<string>` for O(1) solved checks. The dashboard and Learn page swap from the generic problems list to the existing `/users/me/learning-path` endpoint. Code is autosaved to `localStorage` keyed by problem ID, restored on revisit, and cleared on submit.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js 15 + Tailwind + shadcn/ui + Lucide (frontend), `localStorage` for draft persistence.

---

## File Map

| File | Change |
|------|--------|
| `backend/schemas/submission.py` | Add `SolvedProblemIdsOut` schema |
| `backend/api/submissions.py` | Add `GET /submissions/me/problem-ids` route |
| `backend/tests/test_submissions.py` | Add 2 tests for the new route |
| `frontend/lib/api.ts` | Add `SolvedProblemIdsOut` type |
| `frontend/app/problems/page.tsx` | Add beginner filter + solved indicators |
| `frontend/app/dashboard/page.tsx` | Use learning path API, better first-time state |
| `frontend/app/learn/page.tsx` | Replace empty state with personalized path |
| `frontend/app/practice/[id]/page.tsx` | Code autosave + post-review state |
| `frontend/components/practice/ai-panel.tsx` | Post-review CTA banner |

---

### Task 1: Backend — `GET /submissions/me/problem-ids`

**Files:**
- Modify: `backend/schemas/submission.py`
- Modify: `backend/api/submissions.py`
- Modify: `backend/tests/test_submissions.py`

- [ ] **Step 1: Write failing tests**

Add to the bottom of `backend/tests/test_submissions.py`:

```python
def test_list_solved_problem_ids_empty(auth_client: TestClient):
    """GET /submissions/me/problem-ids returns empty list when user has no submissions."""
    res = auth_client.get("/submissions/me/problem-ids")
    assert res.status_code == 200
    assert res.json() == {"solved_ids": []}


def test_list_solved_problem_ids_requires_auth(client: TestClient):
    """GET /submissions/me/problem-ids without token returns 401."""
    res = client.get("/submissions/me/problem-ids")
    assert res.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_submissions.py::test_list_solved_problem_ids_empty tests/test_submissions.py::test_list_solved_problem_ids_requires_auth -v
```

Expected: FAIL with 404 (route doesn't exist yet)

- [ ] **Step 3: Add schema to `backend/schemas/submission.py`**

Add at the bottom of the file, after `SubmissionHistoryItem`:

```python
class SolvedProblemIdsOut(BaseModel):
    solved_ids: list[uuid.UUID]
```

- [ ] **Step 4: Add the route to `backend/api/submissions.py`**

Update the import line for `schemas.submission` to include the new schema:

```python
from schemas.submission import SubmissionCreate, SubmissionHistoryItem, SubmissionOut, SolvedProblemIdsOut
```

Add this route **before** the `@router.post("")` route (between `list_my_submissions` and `create_submission`):

```python
@router.get("/me/problem-ids", response_model=SolvedProblemIdsOut)
def list_my_solved_problem_ids(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SolvedProblemIdsOut:
    rows = (
        db.query(Submission.problem_id)
        .filter(Submission.user_id == current_user.id)
        .distinct()
        .all()
    )
    return SolvedProblemIdsOut(solved_ids=[r.problem_id for r in rows])
```

- [ ] **Step 5: Run all submission tests**

```bash
cd backend && uv run pytest tests/test_submissions.py -v
```

Expected: All 6 tests pass (4 pre-existing + 2 new)

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd backend && uv run pytest -v
```

Expected: All 48+ tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/schemas/submission.py backend/api/submissions.py backend/tests/test_submissions.py
git commit -m "feat(api): add GET /submissions/me/problem-ids for client-side solved tracking"
```

---

### Task 2: Frontend — Add `SolvedProblemIdsOut` type

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add type after `SubmissionHistoryItem`**

In `frontend/lib/api.ts`, add after the `SubmissionHistoryItem` type block:

```typescript
export type SolvedProblemIdsOut = {
  solved_ids: string[];
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(frontend): add SolvedProblemIdsOut type"
```

---

### Task 3: Problems page — Beginner filter + solved indicators

**Files:**
- Modify: `frontend/app/problems/page.tsx`

- [ ] **Step 1: Add Beginner to the difficulty filter**

In `frontend/app/problems/page.tsx`, replace the `DIFFICULTIES` constant:

```typescript
const DIFFICULTIES = [
  { label: "All", value: "" },
  { label: "Beginner", value: "beginner" },
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
];
```

- [ ] **Step 2: Update imports**

Replace the lucide-react import line:

```typescript
import { CheckCircle2, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
```

Replace the `@/lib/api` import line:

```typescript
import { apiFetch, type SolvedProblemIdsOut } from "@/lib/api";
```

- [ ] **Step 3: Add `solvedIds` state**

Inside the `ProblemsPage` component, add this state after the existing `useState` declarations:

```typescript
const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 4: Fetch solved IDs after auth**

In the `authenticate()` async function inside the first `useEffect`, after `setToken(t)`, add:

```typescript
try {
  const data = await apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token: t });
  setSolvedIds(new Set(data.solved_ids));
} catch {
  // non-critical — solved badges just won't show
}
```

- [ ] **Step 5: Add Solved badge to problem cards**

Find the `<div className="mt-2 flex flex-wrap items-center gap-2">` inside the problem card (the row containing Language and Difficulty badges). Add the solved badge as the first child of that div:

```tsx
<div className="mt-2 flex flex-wrap items-center gap-2">
  {solvedIds.has(p.id) && (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="size-3" />
      Solved
    </span>
  )}
  <Badge variant="secondary" className="capitalize">
    {p.language}
  </Badge>
  <Badge variant={difficultyBadgeVariant(p.difficulty)} className="capitalize">
    {p.difficulty}
  </Badge>
  {p.topic?.slice(0, 3).map((t) => (
    <span key={t} className="text-xs text-muted-foreground">
      {t.replace(/_/g, " ")}
    </span>
  ))}
  {(p.topic?.length ?? 0) > 3 && (
    <span className="text-xs text-muted-foreground/60">
      +{p.topic.length - 3} more
    </span>
  )}
</div>
```

- [ ] **Step 6: Verify in browser**

```bash
make dev
```

Navigate to `http://localhost:3000/problems`. Confirm:
- "Beginner" pill appears in the difficulty filter row
- Clicking "Beginner" filters correctly
- Any problems you've previously submitted show a green "Solved" badge

- [ ] **Step 7: Commit**

```bash
git add frontend/app/problems/page.tsx
git commit -m "feat(problems): add beginner difficulty filter and solved indicators"
```

---

### Task 4: Dashboard — personalized learning path + first-time CTA

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Update imports and replace state**

In `frontend/app/dashboard/page.tsx`, update the lucide import to include `ArrowRight` if not already present:

```typescript
import { ArrowRight, BookOpen, ExternalLink, LogOut, Sparkles, Star, Zap } from "lucide-react";
```

Replace the `@/lib/api` import:

```typescript
import { apiFetch, type UserOut, type SubmissionHistoryItem, type LearningPathOut, type LearningPathProblem } from "@/lib/api";
```

Remove the local `ProblemItem` and `ProblemList` type declarations (delete those 8 lines).

Replace the `recommendedProblems` state declaration:

```typescript
const [learningPath, setLearningPath] = useState<LearningPathProblem[]>([]);
const [learningPathMessage, setLearningPathMessage] = useState("");
```

- [ ] **Step 2: Swap the API call in `load()`**

In the `load()` function, replace the `Promise.all` call:

```typescript
const [user, submissions, path] = await Promise.all([
  apiFetch<UserOut>("/users/me", { token }),
  apiFetch<SubmissionHistoryItem[]>("/submissions/me?limit=3", { token }),
  apiFetch<LearningPathOut>("/users/me/learning-path", { token }),
]);
if (!user.is_profile_complete) {
  router.replace("/profile/setup");
  return;
}
setProfile(user);
setRecentSubmissions(submissions);
setLearningPath(path.problems.slice(0, 4));
setLearningPathMessage(path.message);
```

- [ ] **Step 3: Replace the "Practice now" section**

Find and replace the entire `{recommendedProblems.length > 0 && (...)}` block with:

```tsx
{learningPath.length > 0 && (
  <div className="mt-6">
    <div className="mb-1 flex items-center justify-between">
      <h2 className="text-sm font-semibold">Your learning path</h2>
      <Link href="/learn" className="text-xs font-medium text-primary hover:underline">
        View full path →
      </Link>
    </div>
    <p className="mb-3 text-xs text-muted-foreground">{learningPathMessage}</p>
    <ul className="space-y-2">
      {learningPath.map((p, idx) => (
        <li key={p.id}>
          <Link
            href={`/practice/${p.id}`}
            className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                  {p.topic.slice(0, 2).join(", ")}
                </p>
              </div>
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <Badge variant="secondary" className="capitalize text-xs">
                {p.language}
              </Badge>
              <Badge
                variant={difficultyBadgeVariant(p.difficulty)}
                className="capitalize text-xs"
              >
                {p.difficulty}
              </Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 4: Replace the empty state**

Find and replace the `{recentSubmissions.length === 0 && recommendedProblems.length === 0 && (...)}` block with:

```tsx
{recentSubmissions.length === 0 && learningPath.length > 0 && (
  <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
    <p className="text-sm font-semibold">Ready to start your journey?</p>
    <p className="mt-1 text-sm text-muted-foreground">{learningPathMessage}</p>
    <Link href={`/practice/${learningPath[0].id}`} className="mt-4 inline-block">
      <Button className="gap-2">
        Start Problem 1
        <ArrowRight className="size-4" />
      </Button>
    </Link>
  </div>
)}
```

- [ ] **Step 5: Verify in browser**

Navigate to `http://localhost:3000/dashboard`. Confirm:
- "Your learning path" section shows 4 numbered problems matching the user's onboarding selections
- "View full path →" links to `/learn`
- A new account (no submissions) shows the "Ready to start" CTA with "Start Problem 1"

- [ ] **Step 6: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat(dashboard): personalized learning path + first-time CTA"
```

---

### Task 5: Learn page — show personalized learning path

**Files:**
- Modify: `frontend/app/learn/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `frontend/app/learn/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getValidatedAccessToken } from "@/lib/auth-session";
import {
  apiFetch,
  type LearningPathOut,
  type LearningPathProblem,
  type SolvedProblemIdsOut,
} from "@/lib/api";
import { difficultyBadgeVariant } from "@/lib/tags";

export default function LearnPage() {
  const router = useRouter();
  const [learningPath, setLearningPath] = useState<LearningPathOut | null>(null);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const token = await getValidatedAccessToken(supabase);
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const [path, solved] = await Promise.all([
          apiFetch<LearningPathOut>("/users/me/learning-path", { token }),
          apiFetch<SolvedProblemIdsOut>("/submissions/me/problem-ids", { token }),
        ]);
        setLearningPath(path);
        setSolvedIds(new Set(solved.solved_ids));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-6 py-10">
          <div className="h-7 w-48 animate-pulse rounded-xl bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-muted/60" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-border/50 bg-muted/40"
              />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Your Learning Path</h1>
        {learningPath?.message && (
          <p className="mt-1 text-sm text-muted-foreground">{learningPath.message}</p>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {!error && learningPath && (
          <ol className="mt-8 space-y-3">
            {learningPath.problems.map((problem, idx) => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                index={idx + 1}
                solved={solvedIds.has(problem.id)}
              />
            ))}
          </ol>
        )}
      </div>
    </AppShell>
  );
}

function ProblemCard({
  problem,
  index,
  solved,
}: {
  problem: LearningPathProblem;
  index: number;
  solved: boolean;
}) {
  return (
    <li>
      <Link
        href={`/practice/${problem.id}`}
        className={`group flex items-center gap-4 rounded-xl border bg-card px-4 py-3 shadow-card transition-all hover:shadow-md ${
          solved
            ? "border-emerald-500/20 hover:border-emerald-500/40"
            : "border-border/80 hover:border-primary/30"
        }`}
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            solved
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {solved ? <CheckCircle2 className="size-4" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-primary">{problem.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={difficultyBadgeVariant(problem.difficulty)}
              className="capitalize text-xs"
            >
              {problem.difficulty}
            </Badge>
            {problem.topic.slice(0, 3).map((t) => (
              <span key={t} className="text-xs text-muted-foreground capitalize">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </Link>
    </li>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/learn`. Confirm:
- Page shows "Your Learning Path" heading with the personalized message
- 12 problems listed as a numbered progression
- Previously solved problems show a green checkmark instead of a number; their card border is green-tinted
- Clicking any problem navigates to the practice IDE

- [ ] **Step 3: Commit**

```bash
git add frontend/app/learn/page.tsx
git commit -m "feat(learn): replace coming-soon stub with personalized learning path"
```

---

### Task 6: Practice page — code autosave to localStorage

**Files:**
- Modify: `frontend/app/practice/[id]/page.tsx`

- [ ] **Step 1: Add `draftRestored` state**

Inside `PracticePage`, add this state after the existing state declarations:

```typescript
const [draftRestored, setDraftRestored] = useState(false);
```

- [ ] **Step 2: Restore draft on problem load**

In the `load()` function inside the first `useEffect`, replace:

```typescript
setCode(getStarterCode(p.language));
```

with:

```typescript
const draft = localStorage.getItem(`cm_code_${id}`);
setCode(draft ?? getStarterCode(p.language));
if (draft) {
  setDraftRestored(true);
  setTimeout(() => setDraftRestored(false), 3000);
}
```

- [ ] **Step 3: Autosave code on change**

Add a new `useEffect` after the existing problem-load `useEffect`:

```typescript
useEffect(() => {
  if (!id || !code) return;
  const timer = setTimeout(() => {
    localStorage.setItem(`cm_code_${id}`, code);
  }, 500);
  return () => clearTimeout(timer);
}, [id, code]);
```

- [ ] **Step 4: Clear draft on submit**

In `handleSubmit()`, add this line right after `setStreaming(true)`:

```typescript
if (id) localStorage.removeItem(`cm_code_${id}`);
```

- [ ] **Step 5: Show "Draft restored" chip in the header**

In the `AppHeader` JSX, the `meta` prop renders badges inline with the title. Update it to include the chip:

```tsx
meta={
  <span className="ml-1 flex items-center gap-1.5">
    <Badge variant="secondary" className="capitalize">
      {problem.language}
    </Badge>
    <Badge variant={difficultyBadgeVariant(problem.difficulty)} className="capitalize">
      {problem.difficulty}
    </Badge>
    {draftRestored && (
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        Draft restored
      </span>
    )}
  </span>
}
```

- [ ] **Step 6: Verify in browser**

1. Open any problem — type some code in the editor
2. Navigate away to `/problems`
3. Navigate back to the same problem via the URL
4. Confirm: the code is restored and "Draft restored" appears briefly in the header
5. Submit the code — then leave and revisit — confirm it starts fresh with starter code

- [ ] **Step 7: Commit**

```bash
git add frontend/app/practice/[id]/page.tsx
git commit -m "feat(practice): autosave code to localStorage, restore draft on revisit"
```

---

### Task 7: Practice page — post-review completion CTA

**Files:**
- Modify: `frontend/app/practice/[id]/page.tsx`
- Modify: `frontend/components/practice/ai-panel.tsx`

- [ ] **Step 1: Add `reviewComplete` state to practice page**

In `frontend/app/practice/[id]/page.tsx`, add state after other state declarations:

```typescript
const [reviewComplete, setReviewComplete] = useState(false);
```

- [ ] **Step 2: Reset and set `reviewComplete` in `handleSubmit`**

In `handleSubmit()`, add `setReviewComplete(false)` right after `setStreaming(true)`:

```typescript
setReviewComplete(false);
```

In the `onDone` callback of `streamReview(...)`, add `setReviewComplete(true)` after the XP line:

```typescript
onDone: (payload) => {
  const xp = payload.xp_earned;
  if (typeof xp === "number" && xp > 0) setXpEarned(xp);
  setReviewComplete(true);
},
```

- [ ] **Step 3: Pass `reviewComplete` to `AiPanel`**

Find the `<AiPanel` JSX in the render section and add:

```tsx
reviewComplete={reviewComplete}
```

- [ ] **Step 4: Add `reviewComplete` prop to `AiPanelProps` type**

In `frontend/components/practice/ai-panel.tsx`, add to the `AiPanelProps` type:

```typescript
reviewComplete?: boolean;
```

Add `reviewComplete` to the destructured parameters of `AiPanel`:

```typescript
export function AiPanel({
  activeTab,
  onTabChange,
  review,
  hints,
  hintCount,
  solution,
  codeReview,
  chatMessages,
  chatInput,
  onChatInputChange,
  solutionLevel,
  onSolutionLevelChange,
  loading,
  xpEarned,
  onRequestHint,
  onRequestSolution,
  onRequestCodeReview,
  onSendChat,
  reviewComplete,
  onClose,
}: AiPanelProps) {
```

Add the `Link` import at the top of `ai-panel.tsx`:

```typescript
import Link from "next/link";
```

- [ ] **Step 5: Add the CTA banner in the review tab**

In the `{activeTab === "review" && ...}` block, find where `review` content is rendered:

```tsx
{review ? (
  <MarkdownContent content={review} />
) : !loading ? (
  <EmptyState ... />
) : null}
```

Replace with:

```tsx
{review ? (
  <>
    <MarkdownContent content={review} />
    {reviewComplete && (
      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Review complete!
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Keep going — consistency is how skills are built.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href="/problems">
            <Button size="sm" variant="outline" className="text-xs">
              Browse problems
            </Button>
          </Link>
          <Link href="/learn">
            <Button size="sm" className="text-xs">
              Your learning path
            </Button>
          </Link>
        </div>
      </div>
    )}
  </>
) : !loading ? (
  <EmptyState
    icon={<Sparkles className="size-5" />}
    title="No review yet"
    description="Submit your code to get instant feedback on correctness and style."
  />
) : null}
```

- [ ] **Step 6: Verify in browser**

1. Open a problem, write any code, click **Submit code**
2. Wait for the streaming review to finish completely
3. Confirm: a green "Review complete!" banner appears below the review text with two buttons
4. Click "Browse problems" → goes to `/problems`
5. Click "Your learning path" → goes to `/learn`

- [ ] **Step 7: Commit**

```bash
git add frontend/app/practice/[id]/page.tsx frontend/components/practice/ai-panel.tsx
git commit -m "feat(practice): post-review CTA banner with learning path and problems links"
```
