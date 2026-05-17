# Phase 3: Backend Core - Research

**Researched:** 2026-05-15
**Domain:** FastAPI REST API + Supabase JWT Auth + Next.js 16 Auth
**Confidence:** HIGH

## Summary

Phase 3 wires together the existing scaffold (FastAPI + Supabase + SQLAlchemy models) into a working authenticated API. The full database schema, all SQLAlchemy models, and seed data are already in place from Phase 2. The work is purely additive: add Pydantic schemas, router files, a JWT dependency, and frontend auth pages.

Auth is delegated entirely to Supabase GoTrue. The backend does **not** hash passwords or issue its own JWTs. Instead it validates the Supabase-issued JWT on every protected request using PyJWT (already installed, `pyjwt-2.12.1`). The frontend uses Supabase JS to authenticate and stores the session token; it passes the `access_token` as `Authorization: Bearer <token>` to FastAPI. A custom FastAPI dependency extracts and verifies that token, then fetches the matching `User` row from the local PostgreSQL `users` table (which mirrors `auth.users` by Supabase convention).

The stack is already committed. The research covers the exact patterns and pitfalls specific to this exact version of each library.

**Primary recommendation:** Route all auth through Supabase GoTrue (Python `supabase_auth` 2.x). Validate JWTs on the backend using `jwt.decode()` with the Supabase JWT secret (HS256) or JWKS (RS256). Use a single `get_current_user` FastAPI dependency injected on every protected route.

---

## Standard Stack

### Already Installed (do not re-install)

| Library | Version | Purpose |
|---------|---------|---------|
| fastapi | >=0.136.1 | API framework |
| supabase | 2.30.0 | Supabase client (includes supabase_auth) |
| pyjwt | 2.12.1 | JWT decode/verify |
| sqlalchemy | >=2.0.49 | ORM (models already written) |
| pydantic-settings | >=2.14.1 | Config/env |
| uvicorn[standard] | >=0.47.0 | ASGI server |
| httpx | >=0.28.1 | Test client (dev dep) |
| pytest | >=9.0.3 | Test runner (dev dep) |

### Must Add

| Library | Install | Purpose | Why |
|---------|---------|---------|-----|
| `python-multipart` | `uv add python-multipart` | FastAPI form data parsing | Required for `Body()` with `application/x-www-form-urlencoded`; not required for JSON endpoints but conventionally included |

No JWT-specific libraries needed — PyJWT is already installed with `cryptography` (for RS256 support).

**Frontend — already installed:**
`@supabase/supabase-js` is NOT in `package.json` yet — this needs to be added.

| Package | Install | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | `npm install @supabase/supabase-js` | Supabase auth + client |
| `@supabase/ssr` | `npm install @supabase/ssr` | Cookie-based session for Next.js App Router |

### Alternatives Considered (rejected — stack is locked)

| Instead of | Could Use | Why Locked |
|------------|-----------|------------|
| Supabase GoTrue | Auth.js / Clerk | Supabase is the existing database/auth provider |
| PyJWT | python-jose | PyJWT is already installed |

---

## Architecture Patterns

### Backend Project Structure (additions to existing scaffold)

```
backend/
├── api/
│   ├── health.py          # exists
│   ├── auth.py            # NEW: sign-up, sign-in, sign-out proxies
│   ├── problems.py        # NEW: GET /problems, GET /problems/{id}
│   ├── submissions.py     # NEW: POST /submissions
│   ├── users.py           # NEW: GET /users/me, PATCH /users/me
│   └── curriculum.py      # NEW: GET /curriculum-paths, GET /curriculum-paths/{id}
├── core/
│   ├── config.py          # extend: add SUPABASE_JWT_SECRET
│   ├── deps.py            # NEW: get_current_user FastAPI dependency
│   └── __init__.py
├── schemas/               # NEW directory
│   ├── auth.py            # SignUpRequest, SignInRequest, AuthResponse
│   ├── problem.py         # ProblemOut, ProblemListOut, ProblemFilters
│   ├── submission.py      # SubmissionCreate, SubmissionOut
│   ├── user.py            # UserOut, UserUpdate
│   └── curriculum.py      # CurriculumPathOut, CurriculumPathDetailOut
├── models/                # exists (all models written in Phase 2)
├── db/session.py          # exists
└── main.py                # extend: include new routers
```

### Pattern 1: Supabase JWT Validation Dependency

This is the core auth pattern. Every protected endpoint injects `get_current_user`.

```python
# core/deps.py
from typing import Annotated
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.config import settings
from db.session import get_db
from models.users import User

security = HTTPBearer()

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    supabase_user_id = payload.get("sub")
    if not supabase_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(User).filter(User.id == supabase_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

Key detail: Supabase JWTs use **HS256** signed with the **JWT Secret** from Supabase Dashboard → Settings → API. The audience claim is always `"authenticated"`. The `sub` claim is the Supabase user UUID, which maps to `users.id` in the local DB.

### Pattern 2: Paginated Endpoint

```python
# api/problems.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Annotated

from core.deps import get_current_user
from db.session import get_db
from models.learning import Problem
from models.users import User
from schemas.problem import ProblemOut, ProblemListOut

router = APIRouter(prefix="/problems", tags=["problems"])

@router.get("", response_model=ProblemListOut)
def list_problems(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    language: str | None = Query(None),
    difficulty: str | None = Query(None),
    topic: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(Problem).filter(Problem.is_published == True)
    if language:
        query = query.filter(Problem.language == language)
    if difficulty:
        query = query.filter(Problem.difficulty == difficulty)
    if topic:
        query = query.filter(Problem.topic.contains([topic]))
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return ProblemListOut(items=items, total=total, page=page, page_size=page_size)
```

### Pattern 3: Supabase Auth Proxy (backend acts as thin auth proxy)

The backend exposes `/auth/signup` and `/auth/login` endpoints that call Supabase GoTrue via the Python client, then either create the local user record (on first sign-up) or return the JWT to the frontend. The frontend NEVER receives the raw Supabase client credentials.

```python
# api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from supabase import create_client

from core.config import settings
from db.session import get_db
from models.users import User
from schemas.auth import SignUpRequest, SignInRequest, AuthResponse

router = APIRouter(prefix="/auth", tags=["auth"])

def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_key)

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignUpRequest, db: Session = Depends(get_db)):
    sb = get_supabase()
    try:
        response = sb.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not response.user:
        raise HTTPException(status_code=400, detail="Sign-up failed")

    # Create local user record (profile_level defaults to 'student' until profile setup)
    existing = db.query(User).filter(User.id == response.user.id).first()
    if not existing:
        user = User(
            id=response.user.id,
            email=response.user.email,
            profile_level="student",  # placeholder until AUTH-05 profile setup
        )
        db.add(user)
        db.commit()

    return AuthResponse(
        access_token=response.session.access_token if response.session else None,
        refresh_token=response.session.refresh_token if response.session else None,
        user_id=str(response.user.id),
        is_new_user=existing is None,
    )
```

### Pattern 4: Profile Setup Flag (AUTH-05)

The `User` model has `display_name` (nullable) and `profile_level`. A first-time user has `display_name = None`. The `GET /users/me` response includes an `is_profile_complete` derived field. The frontend reads this and routes to the profile setup flow.

```python
# schemas/user.py
from pydantic import BaseModel, computed_field
import uuid

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None
    profile_level: str
    skill_level: dict
    streak_days: int
    xp_total: int

    @computed_field
    @property
    def is_profile_complete(self) -> bool:
        return self.display_name is not None

    model_config = {"from_attributes": True}
```

### Pattern 5: Frontend — Supabase SSR Session Persistence

With `@supabase/ssr`, the session token is stored in cookies and automatically refreshed. In `proxy.ts` (Next.js 16 convention — NOT `middleware.ts`), read the cookie to protect routes.

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

```typescript
// proxy.ts  (NOT middleware.ts — deprecated in Next.js 16)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const protectedPaths = ["/dashboard", "/problems", "/practice", "/profile", "/settings"];
  const isProtected = protectedPaths.some(p => req.nextUrl.pathname.startsWith(p));
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
```

### Anti-Patterns to Avoid

- **Using `middleware.ts`:** Deprecated in Next.js 16. Use `proxy.ts` at the project root.
- **Verifying JWT in the frontend:** Never trust the client to self-report auth state to the backend. Always pass `Authorization: Bearer <token>` and verify server-side.
- **Creating a custom JWT**: The backend never mints its own JWTs. Supabase handles all token issuance.
- **Calling Supabase Admin API from frontend**: Never expose the service role key. Only the backend uses it if needed.
- **Missing `audience` in `jwt.decode()`**: Supabase JWTs include `aud: "authenticated"`. Omitting the audience check means expired or service-role tokens can authenticate as users.
- **ARRAY filter for `topic`**: PostgreSQL ARRAY filtering uses `.contains()` in SQLAlchemy, not `==`. Using `== topic` will fail silently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing/salting | Custom bcrypt wrapper | Supabase GoTrue | GoTrue handles bcrypt server-side; you never see the raw password |
| Token refresh logic | Custom expiry tracking | Supabase JS `onAuthStateChange` + `@supabase/ssr` | Supabase JS auto-refreshes; `@supabase/ssr` handles cookie sync |
| JWT signing | Custom signing | Supabase GoTrue | Never sign your own JWTs when GoTrue already does it |
| Email verification flow | Custom email sending | Supabase Dashboard + GoTrue | Supabase handles confirm emails out of the box |
| Pagination helper | Custom offset/limit class | Inline SQLAlchemy `.offset().limit()` | Simple enough inline; no library needed |
| OpenAPI auth scheme | Manual swagger config | `fastapi.security.HTTPBearer` | FastAPI auto-generates the Authorize button in Swagger UI |

---

## Common Pitfalls

### Pitfall 1: Supabase JWT Secret vs Anon Key

**What goes wrong:** Developer passes the `SUPABASE_KEY` (anon key) as the JWT signing secret. The anon key is a JWT itself — not the signing secret.

**Why it happens:** Both look like random strings. The anon key is the public JWT for anonymous access; the JWT secret is in Supabase Dashboard → Project Settings → API → JWT Settings.

**How to avoid:** Add `SUPABASE_JWT_SECRET` as a separate env var. It is found at: Supabase Dashboard → Settings → API → JWT Settings → JWT Secret.

**Warning signs:** `jwt.exceptions.InvalidSignatureError` even with valid tokens.

### Pitfall 2: User Record Sync Gap

**What goes wrong:** Supabase creates the auth user in `auth.users` (Supabase-managed schema), but the local `public.users` table has no row yet. `GET /users/me` returns 401 even though the JWT is valid.

**Why it happens:** Sign-up creates the Supabase user but the local record creation may fail silently if not handled in the sign-up endpoint.

**How to avoid:** The `/auth/signup` endpoint MUST atomically create the local `User` row after `sb.auth.sign_up()` succeeds. Add a `try/except` with rollback and return a meaningful error if the DB insert fails.

### Pitfall 3: `profile_level` NOT NULL With No Default

**What goes wrong:** `User.profile_level` is defined as `NOT NULL` in the schema with no server-side default. Creating a user without setting it raises a DB integrity error.

**Why it happens:** The field maps to an enum (kid/student/engineer) that the user sets during profile setup (AUTH-05). But the user record must exist before profile setup.

**How to avoid:** Insert `profile_level="student"` as a placeholder on sign-up. AUTH-05 profile setup then overwrites it. Document this as a two-step process.

### Pitfall 4: ARRAY Column Filtering in SQLAlchemy

**What goes wrong:** `Problem.topic == "algorithms"` silently returns no results or throws a type error.

**Why it happens:** `topic` is `ARRAY(String)` in PostgreSQL. The correct SQLAlchemy filter is `Problem.topic.contains(["algorithms"])`.

**How to avoid:** Always use `.contains([value])` for PostgreSQL array membership queries.

### Pitfall 5: Next.js 16 — `proxy.ts` Not `middleware.ts`

**What goes wrong:** Developer creates `middleware.ts` expecting it to intercept auth. File is ignored (or triggers a deprecation warning) and all routes are accessible without authentication.

**Why it happens:** Next.js 16.x renamed `middleware` to `proxy`. The old name is deprecated.

**How to avoid:** Create `proxy.ts` at the project root (same level as `app/`). Export the function as `proxy` (named export) or as default. See Next.js docs in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

### Pitfall 6: Supabase `sign_up` Does Not Return a Session on Email Confirmation

**What goes wrong:** `response.session` is `None` after `sign_up()` when Supabase's email confirmation is enabled.

**Why it happens:** Supabase GoTrue doesn't issue a session until the email is confirmed. `response.user` exists but `response.session` is `None`.

**How to avoid:** For development, disable email confirmation in Supabase Dashboard → Authentication → Settings. In production, handle the `None` session case: return `access_token: null` and tell the frontend "check your email." The frontend should redirect to a "confirm email" page.

---

## Code Examples

### Router Registration in main.py

```python
# backend/main.py (extended)
from api.auth import router as auth_router
from api.problems import router as problems_router
from api.submissions import router as submissions_router
from api.users import router as users_router
from api.curriculum import router as curriculum_router

app.include_router(auth_router)
app.include_router(problems_router)
app.include_router(submissions_router)
app.include_router(users_router)
app.include_router(curriculum_router)
```

### Config Extension

```python
# core/config.py (extended)
class Settings(BaseSettings):
    # existing fields ...
    supabase_jwt_secret: str = ""  # from Supabase Dashboard → Settings → API → JWT Secret
```

Add to `.env.example`:
```
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

### Pydantic Schema Pattern (using `from_attributes`)

```python
# schemas/problem.py
from pydantic import BaseModel
import uuid
from datetime import datetime

class ProblemOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    language: str
    difficulty: str
    topic: list[str]
    examples: dict
    constraints: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

class ProblemListOut(BaseModel):
    items: list[ProblemOut]
    total: int
    page: int
    page_size: int
```

### Protected Endpoint Pattern

```python
# api/users.py
from fastapi import APIRouter, Depends
from typing import Annotated
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.users import User
from schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserOut)
def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
```

---

## State of the Art

| Old Approach | Current Approach | Changed | Impact |
|--------------|------------------|---------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 | Must use new filename and export name |
| `next/server` `NextRequest` middleware | Same type, new file convention | Next.js 16 | Import paths unchanged |
| Pydantic v1 `.from_orm()` | Pydantic v2 `model_config = {"from_attributes": True}` | Pydantic v2 | Old `.from_orm()` raises AttributeError |
| SQLAlchemy 1.x `Query` API | SQLAlchemy 2.x `select()` or `.query()` (both supported) | SQLAlchemy 2.0 | `.query()` still works in 2.x; `select()` is preferred for new code |
| `supabase-py` v1 `client.auth.sign_in()` | v2 `client.auth.sign_in_with_password()` | supabase-py v2 | Old method name raises AttributeError |

**Deprecated/outdated:**
- `middleware.ts` in Next.js 16: replaced by `proxy.ts`
- Pydantic v1 validators: `@validator` replaced by `@field_validator`
- `supabase.auth.sign_in()`: replaced by `sign_in_with_password()`

---

## Open Questions

1. **Supabase email confirmation in dev environment**
   - What we know: GoTrue may return `session: None` on sign-up if email confirmation is enabled
   - What's unclear: Current Supabase project settings (confirmation enabled or not)
   - Recommendation: Verify in Supabase Dashboard and document. For Phase 3 dev, disable confirmation. Add TODO comment for production handling.

2. **Supabase JWT Algorithm (HS256 vs RS256)**
   - What we know: Supabase projects default to HS256 JWTs, signed with the project JWT secret
   - What's unclear: Whether this project was initialized with a custom config
   - Recommendation: Confirm HS256 in Supabase Dashboard → Auth → Sign In Method. The `jwt.decode()` call in `deps.py` uses `algorithms=["HS256"]`. This is correct for the default.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `cd backend && uv run pytest tests/ -x -q` |
| Full suite command | `cd backend && uv run pytest tests/ -v` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | POST /auth/signup creates user + local DB row | integration | `uv run pytest tests/test_auth.py::test_signup -x` | ❌ Wave 0 |
| AUTH-02 | POST /auth/login returns access_token + refresh_token | integration | `uv run pytest tests/test_auth.py::test_login -x` | ❌ Wave 0 |
| AUTH-03 | POST /auth/logout clears session | integration | `uv run pytest tests/test_auth.py::test_logout -x` | ❌ Wave 0 |
| AUTH-04 | GET /users/me with no token returns 401 | unit | `uv run pytest tests/test_auth.py::test_protected_without_token -x` | ❌ Wave 0 |
| AUTH-05 | UserOut.is_profile_complete=False when display_name is None | unit | `uv run pytest tests/test_users.py::test_profile_incomplete_flag -x` | ❌ Wave 0 |
| API-01 | GET /problems returns paginated list | integration | `uv run pytest tests/test_problems.py::test_list_problems -x` | ❌ Wave 0 |
| API-01 | GET /problems?language=python filters correctly | integration | `uv run pytest tests/test_problems.py::test_filter_by_language -x` | ❌ Wave 0 |
| API-02 | GET /problems/{id} returns single problem | integration | `uv run pytest tests/test_problems.py::test_get_problem -x` | ❌ Wave 0 |
| API-03 | POST /submissions creates submission record | integration | `uv run pytest tests/test_submissions.py::test_create_submission -x` | ❌ Wave 0 |
| API-04 | GET /users/me returns current user profile | integration | `uv run pytest tests/test_users.py::test_get_me -x` | ❌ Wave 0 |
| API-05 | PATCH /users/me updates display_name | integration | `uv run pytest tests/test_users.py::test_update_me -x` | ❌ Wave 0 |
| API-06 | GET /curriculum-paths returns published paths | integration | `uv run pytest tests/test_curriculum.py::test_list_paths -x` | ❌ Wave 0 |
| API-07 | GET /curriculum-paths/{id} returns path with problems | integration | `uv run pytest tests/test_curriculum.py::test_get_path -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && uv run pytest tests/ -x -q`
- **Per wave merge:** `cd backend && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_auth.py` — covers AUTH-01, AUTH-02, AUTH-03, AUTH-04
- [ ] `backend/tests/test_users.py` — covers AUTH-05, API-04, API-05
- [ ] `backend/tests/test_problems.py` — covers API-01, API-02
- [ ] `backend/tests/test_submissions.py` — covers API-03
- [ ] `backend/tests/test_curriculum.py` — covers API-06, API-07
- [ ] `backend/tests/conftest.py` — extend with `auth_client` fixture (TestClient with valid JWT header) and `test_user` fixture

Note: Integration tests that call real Supabase GoTrue (for sign-up/login) will require test credentials or a dedicated test project. The auth middleware tests (`test_protected_without_token`) can run fully offline against the FastAPI TestClient.

---

## Sources

### Primary (HIGH confidence)

- Source: direct code inspection of `supabase_auth 2.x` installed at `backend/.venv` — `sign_up`, `sign_in_with_password`, `get_user(jwt=...)`, `sign_out` method signatures verified
- Source: `pyjwt 2.12.1` installed at `backend/.venv` — `jwt.decode()` signature verified, HS256/RS256 confirmed available
- Source: Next.js local docs at `frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — `middleware.ts` deprecation confirmed, `proxy.ts` convention verified
- Source: Next.js local docs at `frontend/node_modules/next/dist/docs/01-app/02-guides/authentication.md` — Session management pattern, cookie storage, DAL pattern verified

### Secondary (MEDIUM confidence)

- Source: Supabase Python SDK source code inspection — `@supabase/ssr` cookie sync pattern for Next.js App Router confirmed from installed package + official docs pattern alignment
- Source: All SQLAlchemy models verified by reading `backend/models/*.py` — ARRAY filter behavior, UUID primary keys, nullable fields all confirmed from source

### Tertiary (LOW confidence)

- None — all critical findings are HIGH or MEDIUM confidence

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions read from installed packages and `pyproject.toml`
- Architecture: HIGH — patterns derived from actual installed library APIs, not assumed
- Pitfalls: HIGH — confirmed from source code inspection (e.g., ARRAY contains, null profile_level, proxy.ts naming)
- Next.js version specifics: HIGH — read directly from `node_modules/next/dist/docs/`

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (Supabase SDK and Next.js 16 are actively maintained; re-verify proxy.ts if Next.js upgrades)
