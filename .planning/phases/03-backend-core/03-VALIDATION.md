---
phase: 3
slug: backend-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 |
| **Config file** | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `cd backend && uv run pytest tests/ -x -q` |
| **Full suite command** | `cd backend && uv run pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && uv run pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-auth-01 | auth | 0 | AUTH-01 | integration | `uv run pytest tests/test_auth.py::test_signup -x` | ❌ W0 | ⬜ pending |
| 3-auth-02 | auth | 0 | AUTH-02 | integration | `uv run pytest tests/test_auth.py::test_login -x` | ❌ W0 | ⬜ pending |
| 3-auth-03 | auth | 0 | AUTH-03 | integration | `uv run pytest tests/test_auth.py::test_logout -x` | ❌ W0 | ⬜ pending |
| 3-auth-04 | auth | 0 | AUTH-04 | unit | `uv run pytest tests/test_auth.py::test_protected_without_token -x` | ❌ W0 | ⬜ pending |
| 3-auth-05 | users | 0 | AUTH-05 | unit | `uv run pytest tests/test_users.py::test_profile_incomplete_flag -x` | ❌ W0 | ⬜ pending |
| 3-api-01a | problems | 0 | API-01 | integration | `uv run pytest tests/test_problems.py::test_list_problems -x` | ❌ W0 | ⬜ pending |
| 3-api-01b | problems | 0 | API-01 | integration | `uv run pytest tests/test_problems.py::test_filter_by_language -x` | ❌ W0 | ⬜ pending |
| 3-api-02 | problems | 0 | API-02 | integration | `uv run pytest tests/test_problems.py::test_get_problem -x` | ❌ W0 | ⬜ pending |
| 3-api-03 | submissions | 0 | API-03 | integration | `uv run pytest tests/test_submissions.py::test_create_submission -x` | ❌ W0 | ⬜ pending |
| 3-api-04 | users | 0 | API-04 | integration | `uv run pytest tests/test_users.py::test_get_me -x` | ❌ W0 | ⬜ pending |
| 3-api-05 | users | 0 | API-05 | integration | `uv run pytest tests/test_users.py::test_update_me -x` | ❌ W0 | ⬜ pending |
| 3-api-06 | curriculum | 0 | API-06 | integration | `uv run pytest tests/test_curriculum.py::test_list_paths -x` | ❌ W0 | ⬜ pending |
| 3-api-07 | curriculum | 0 | API-07 | integration | `uv run pytest tests/test_curriculum.py::test_get_path -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_auth.py` — stubs for AUTH-01, AUTH-02, AUTH-03, AUTH-04
- [ ] `backend/tests/test_users.py` — stubs for AUTH-05, API-04, API-05
- [ ] `backend/tests/test_problems.py` — stubs for API-01, API-02
- [ ] `backend/tests/test_submissions.py` — stubs for API-03
- [ ] `backend/tests/test_curriculum.py` — stubs for API-06, API-07
- [ ] `backend/tests/conftest.py` — extend with `auth_client` fixture (TestClient with valid JWT header) and `test_user` fixture

Note: Integration tests calling real Supabase GoTrue require test credentials. Auth middleware tests (`test_protected_without_token`) run fully offline.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| JWT persists across browser refreshes | AUTH-01 | Requires real browser session | Log in, close/reopen browser tab, verify session still active |
| Logout clears session from any page | AUTH-02, AUTH-03 | Browser state not testable in pytest | Log in, navigate to /dashboard, click logout, verify redirect to /login |
| First-time user routed to profile setup | AUTH-05 | Frontend routing logic | Sign up, verify redirect to /profile/setup page |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
