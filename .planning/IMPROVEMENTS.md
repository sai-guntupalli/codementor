# CodeMentor Improvement Plan

## Priority 1: Security & Stability (Critical)
- [x] 1.1 Stop leaking internal errors in auth endpoints
- [x] 1.2 Add password validation (min length) to signup schema
- [x] 1.3 Add max_length to all user-input text fields (code, messages, etc.)
- [x] 1.4 Validate enum fields with Literal types in schemas
- [x] 1.5 Restrict ChatMessage.role to prevent system message injection
- [x] 1.6 Add rate limiting on LLM and execute endpoints
- [x] 1.7 Enforce usage quota (llm_calls_per_month)
- [x] 1.8 Fix mutable default arguments in models (default=[] -> default_factory=list)

## Priority 2: Error Handling & Resilience
- [x] 2.1 Wrap DB commits inside SSE generators in try/except
- [x] 2.2 Make usage logging non-fatal (catch and log errors)
- [x] 2.3 Add proper logging across backend (structured logging)
- [x] 2.4 Add deep health check (DB + dependencies)
- [x] 2.5 Handle malformed LLM JSON responses gracefully

## Priority 3: Performance
- [x] 3.1 Use shared httpx.AsyncClient instead of per-request instantiation
- [x] 3.2 Configure connection pool settings on SQLAlchemy engine
- [x] 3.3 Combine count + data query into single DB round-trip for problems list

## Priority 4: Frontend Improvements
- [x] 4.1 Add global error boundary
- [x] 4.2 Add proper loading skeletons for practice page
- [x] 4.3 Add keyboard shortcuts (Ctrl+Enter to submit, Ctrl+R to run)
- [x] 4.4 Add "Forgot password" link on login page
- [x] 4.5 Add proper page titles (metadata) for all pages

## Priority 5: Missing Features
- [x] 5.1 Implement actual logout (invalidate Supabase session)
- [x] 5.2 Update streak_days on submission
- [x] 5.3 Filter out soft-deleted users in queries
- [x] 5.4 Add pagination to GET /submissions/me
