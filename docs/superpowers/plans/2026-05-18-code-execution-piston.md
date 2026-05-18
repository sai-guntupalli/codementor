# Code Execution (Piston) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Run" button to the practice IDE that executes Python code via the Piston API and shows stdout/stderr inline below the editor.

**Architecture:** A new `POST /execute` FastAPI endpoint proxies requests to the public Piston instance (`https://emkc.org/api/v2/piston`), enforcing a code-size limit and a per-request timeout. The frontend adds a "Run" button to the practice page header; clicking it calls the backend, then renders output in a collapsible panel below the Monaco editor. SQL problems skip execution (Piston has no PostgreSQL runtime) — the Run button is hidden for them. No database changes are required.

**Tech Stack:** FastAPI + `httpx` (async HTTP), Piston public API (`emkc.org/api/v2/piston`), Next.js 16 + React 19, Tailwind v4

---

## File Map

### New files
- `backend/api/execute.py` — `POST /execute` router; validates input, calls Piston, returns stdout/stderr/exit_code
- `backend/schemas/execute.py` — `ExecuteRequest` and `ExecuteResult` Pydantic schemas
- `backend/tests/test_execute.py` — unit + integration tests for the execute endpoint
- `frontend/lib/execute-api.ts` — typed `runCode()` helper that calls `POST /execute`

### Modified files
- `backend/main.py` — register `execute_router`
- `frontend/app/practice/[id]/page.tsx` — add `runOutput` state, "Run" button, `OutputPanel` component

---

## Task 1: Backend schemas

**Files:**
- Create: `backend/schemas/execute.py`

- [ ] **Step 1: Create `backend/schemas/execute.py`**

```python
from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    language: str
    code: str = Field(..., max_length=32_000)


class ExecuteResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int | None
    timed_out: bool
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas/execute.py
git commit -m "feat(api): add ExecuteRequest and ExecuteResult schemas"
```

---

## Task 2: Backend — `POST /execute` endpoint (TDD)

**Files:**
- Create: `backend/api/execute.py`
- Create: `backend/tests/test_execute.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_execute.py`:

```python
"""Tests for POST /execute."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


def test_execute_requires_auth(client: TestClient):
    """Unauthenticated request returns 401."""
    res = client.post("/execute", json={"language": "python", "code": "print(1)"})
    assert res.status_code == 401


def test_execute_sql_not_supported(auth_client: TestClient):
    """SQL language returns 422 unsupported."""
    res = auth_client.post("/execute", json={"language": "sql", "code": "SELECT 1"})
    assert res.status_code == 422
    assert "not supported" in res.json()["detail"].lower()


def test_execute_code_too_large(auth_client: TestClient):
    """Code exceeding 32 000 chars is rejected by schema validation."""
    res = auth_client.post(
        "/execute", json={"language": "python", "code": "x" * 33_000}
    )
    assert res.status_code == 422


def test_execute_python_success(auth_client: TestClient):
    """Happy path: valid Python returns stdout."""
    mock_response = {
        "run": {"stdout": "hello\n", "stderr": "", "code": 0, "signal": None}
    }
    with patch(
        "api.execute.httpx.AsyncClient.post",
        new=AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_response,
            raise_for_status=lambda: None,
        )),
    ):
        res = auth_client.post(
            "/execute", json={"language": "python", "code": "print('hello')"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["stdout"] == "hello\n"
    assert data["stderr"] == ""
    assert data["exit_code"] == 0
    assert data["timed_out"] is False


def test_execute_piston_timeout(auth_client: TestClient):
    """Piston timeout returns timed_out=True, no crash."""
    import httpx

    with patch(
        "api.execute.httpx.AsyncClient.post",
        new=AsyncMock(side_effect=httpx.TimeoutException("timed out")),
    ):
        res = auth_client.post(
            "/execute", json={"language": "python", "code": "import time; time.sleep(99)"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["timed_out"] is True
    assert data["stdout"] == ""
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /path/to/project/backend
source .venv/bin/activate
pytest tests/test_execute.py -v
```

Expected: all 5 tests FAIL with `404 Not Found` or `ImportError` (endpoint doesn't exist yet).

- [ ] **Step 3: Implement `backend/api/execute.py`**

```python
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException

from core.deps import get_current_user
from models.users import User
from schemas.execute import ExecuteRequest, ExecuteResult

router = APIRouter(prefix="/execute", tags=["execute"])

PISTON_URL = "https://emkc.org/api/v2/piston/execute"
SUPPORTED_LANGUAGES = {"python"}
# Map our language name → Piston runtime name + pinned version
PISTON_RUNTIMES: dict[str, tuple[str, str]] = {
    "python": ("python", "3.10.0"),
}
PISTON_TIMEOUT = 10.0  # seconds


@router.post("", response_model=ExecuteResult)
async def execute_code(
    body: ExecuteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ExecuteResult:
    if body.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Language '{body.language}' is not supported for execution.",
        )

    runtime, version = PISTON_RUNTIMES[body.language]
    payload = {
        "language": runtime,
        "version": version,
        "files": [{"content": body.code}],
        "stdin": "",
        "args": [],
    }

    try:
        async with httpx.AsyncClient(timeout=PISTON_TIMEOUT) as client:
            resp = await client.post(PISTON_URL, json=payload)
            resp.raise_for_status()
        run = resp.json().get("run", {})
        return ExecuteResult(
            stdout=run.get("stdout", ""),
            stderr=run.get("stderr", ""),
            exit_code=run.get("code"),
            timed_out=False,
        )
    except httpx.TimeoutException:
        return ExecuteResult(stdout="", stderr="", exit_code=None, timed_out=True)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Execution service error: {exc}") from exc
```

- [ ] **Step 4: Register the router in `backend/main.py`**

Add at the top with the other imports:
```python
from api.execute import router as execute_router
```

Add after the last `app.include_router(...)` line:
```python
app.include_router(execute_router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_execute.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
pytest -v
```

Expected: all existing tests still pass (43+ passed, 3 skipped).

- [ ] **Step 7: Commit**

```bash
git add backend/api/execute.py backend/schemas/execute.py backend/tests/test_execute.py backend/main.py
git commit -m "feat(api): add POST /execute endpoint via Piston for Python code execution"
```

---

## Task 3: Frontend — `runCode()` helper

**Files:**
- Create: `frontend/lib/execute-api.ts`

- [ ] **Step 1: Create `frontend/lib/execute-api.ts`**

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type RunResult = {
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;
};

export async function runCode(
  language: string,
  code: string,
  token: string
): Promise<RunResult> {
  const res = await fetch(`${API_URL}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ language, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Execution failed"
    );
  }
  return res.json() as Promise<RunResult>;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/execute-api.ts
git commit -m "feat(frontend): add runCode helper for POST /execute"
```

---

## Task 4: Frontend — Run button + OutputPanel in practice page

**Files:**
- Modify: `frontend/app/practice/[id]/page.tsx`

### 4a — Add state and handler

- [ ] **Step 1: Add `RunResult` import and run state**

At the top of `frontend/app/practice/[id]/page.tsx`, add the import alongside existing ones:

```tsx
import { runCode, type RunResult } from "@/lib/execute-api";
```

Inside `PracticePage`, add these state variables after the existing `useState` declarations:

```tsx
const [runResult, setRunResult] = useState<RunResult | null>(null);
const [running, setRunning] = useState(false);
const [outputOpen, setOutputOpen] = useState(false);
```

- [ ] **Step 2: Add the `handleRun` function**

Add this function inside `PracticePage`, alongside the existing `handleSubmit`, `handleHint`, etc.:

```tsx
async function handleRun() {
  if (!code.trim()) return;
  setRunning(true);
  setOutputOpen(true);
  setRunResult(null);
  try {
    const token = await getToken();
    if (!token) return;
    const result = await runCode(problem.language, code, token);
    setRunResult(result);
  } catch (err) {
    setRunResult({
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

### 4b — Add Run button to the header

- [ ] **Step 3: Add Play icon import**

In the existing lucide-react import at the top of the file, add `Play`:

```tsx
import { ..., Play } from "lucide-react";
```

(Add `Play` to whatever icons are already imported on that line.)

- [ ] **Step 4: Add Run button to the `actions` prop of `AppHeader`**

Find the `actions={...}` block in the `return` (around line 362). Add the Run button **before** the existing "Surprise me" button:

```tsx
actions={
  <>
    <Button
      size="sm"
      variant="outline"
      disabled={running || streaming || problem.language !== "python"}
      onClick={handleRun}
      title={problem.language !== "python" ? "Run is only available for Python" : undefined}
    >
      {running ? (
        <>
          <span className="mr-1.5 size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Running…
        </>
      ) : (
        <>
          <Play className="mr-1.5 size-3.5" />
          Run
        </>
      )}
    </Button>
    <Button
      size="sm"
      variant={aiPanelOpen ? "secondary" : "outline"}
      onClick={() => setAiPanelOpen((o) => !o)}
    >
      ...existing AI Assistant button content unchanged...
    </Button>
    ...existing Surprise me and Submit buttons unchanged...
  </>
}
```

> Note: copy the exact existing button content for AI Assistant, Surprise me, and Submit — only add the new Run button before them.

### 4c — Add OutputPanel below the editor

- [ ] **Step 5: Add the `OutputPanel` component**

Add this component at the **bottom** of `frontend/app/practice/[id]/page.tsx`, after the closing brace of `PracticePage`:

```tsx
function OutputPanel({
  result,
  open,
  running,
  onClose,
}: {
  result: RunResult | null;
  open: boolean;
  running: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="shrink-0 border-t border-border/80 bg-[oklch(0.15_0.03_275)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Output
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-white/40 hover:text-white/70"
        >
          ✕
        </button>
      </div>
      <div className="h-40 overflow-y-auto p-4 font-mono text-xs">
        {running && (
          <span className="text-white/40 animate-pulse">Running…</span>
        )}
        {!running && result?.timed_out && (
          <span className="text-amber-400">Execution timed out (10s limit).</span>
        )}
        {!running && result && !result.timed_out && (
          <>
            {result.stdout && (
              <pre className="whitespace-pre-wrap text-emerald-300">{result.stdout}</pre>
            )}
            {result.stderr && (
              <pre className="whitespace-pre-wrap text-rose-400">{result.stderr}</pre>
            )}
            {!result.stdout && !result.stderr && (
              <span className="text-white/40">(no output)</span>
            )}
            {result.exit_code !== null && result.exit_code !== 0 && (
              <p className="mt-2 text-white/40">
                Exit code: {result.exit_code}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Render `OutputPanel` in the layout**

In the `return` of `PracticePage`, find the closing `</main>` tag. Insert `OutputPanel` **just before it** (after the last `{aiPanelOpen && ...}` mobile AI panel block):

```tsx
      <OutputPanel
        result={runResult}
        open={outputOpen}
        running={running}
        onClose={() => setOutputOpen(false)}
      />
    </main>
```

- [ ] **Step 7: Verify in browser**

Start the dev server:

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/practice/<any-python-problem-id>`.

Verify:
- "Run" button appears in the header for Python problems
- Clicking Run opens the output panel at the bottom with "Running…"
- After ~2s, stdout appears in green (e.g. for `print("hello")` → `hello`)
- stderr appears in red when code has an error (e.g. `1/0` → `ZeroDivisionError`)
- Timeout message appears for `import time; time.sleep(99)`
- "Run" button is visually disabled for SQL problems (if you navigate to one)
- Output panel closes when ✕ is clicked

- [ ] **Step 8: Commit**

```bash
git add frontend/app/practice/[id]/page.tsx frontend/lib/execute-api.ts
git commit -m "feat(frontend): add Run button and OutputPanel for Python code execution"
```

---

## Task 5: Update PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Update PROGRESS.md**

Add to the Completed section:

```
- [2026-05-18] Phase 8: Python code execution via Piston
  - `POST /execute` proxies to emkc.org Piston API; enforces 32KB code limit and 10s timeout
  - Python only (SQL skipped — no PostgreSQL runtime in Piston)
  - Frontend: "Run" button in practice IDE header; OutputPanel shows stdout (green), stderr (red), timeout warning
  - 5 new tests (auth, sql rejection, size limit, success mock, timeout mock); all passing
```

Update Current Status to:
```
Phase 8 complete: Python code execution added — Run button in the practice IDE calls Piston and shows stdout/stderr inline.
```

Update Next Steps to:
```
1. Stripe billing integration — Free/Pro plan enforcement, checkout flow, webhook handling
2. Problem set expansion — seed 50+ Python and SQL problems across difficulty levels
3. Deploy to production — Vercel (frontend) + Railway/Fly.io (backend), set env vars
4. Open PR for review
```

- [ ] **Step 2: Commit**

```bash
git add PROGRESS.md
git commit -m "chore: update PROGRESS.md — Phase 8 code execution complete"
```

---

## Self-Review

**Spec coverage:**
- `POST /execute` with auth guard: ✓ Task 2
- Python-only enforcement (SQL rejected): ✓ Task 2 (422 for SQL)
- 32KB code size limit: ✓ Task 1 (Pydantic `max_length`) + Task 2 test
- 10s timeout handling: ✓ Task 2 (httpx timeout + `timed_out` field)
- Piston runtime mapping: ✓ Task 2 (`PISTON_RUNTIMES` dict)
- `runCode()` frontend helper: ✓ Task 3
- Run button in IDE header: ✓ Task 4b
- Run button disabled for SQL: ✓ Task 4b (`problem.language !== "python"`)
- OutputPanel with stdout/stderr/timeout: ✓ Task 4c
- PROGRESS.md update: ✓ Task 5

**Placeholder scan:** None found.

**Type consistency:**
- `RunResult` defined in Task 3 (`execute-api.ts`), imported in Task 4a — consistent.
- `ExecuteResult` backend schema (Task 1) matches `RunResult` frontend type field-for-field: `stdout`, `stderr`, `exit_code`, `timed_out` — consistent.
- `handleRun` calls `runCode(problem.language, code, token)` — all three variables exist in scope at that point — consistent.
- `OutputPanel` props (`result: RunResult | null`, `open: boolean`, `running: boolean`, `onClose: () => void`) match usage in Task 4 Step 6 — consistent.
