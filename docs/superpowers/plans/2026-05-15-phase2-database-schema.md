# CodeMentor Phase 2: Database Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all 13 database tables from the design spec in Supabase using SQLAlchemy ORM models and Alembic migrations, seeded with initial plans and prompt templates.

**Architecture:** SQLAlchemy declarative models live in `backend/models/`, grouped by domain. Alembic reads models via `env.py` autogenerate. A `seeds/` module inserts reference data (plans, prompts) after migration. The Supabase session pooler URL is used for all connections.

**Tech Stack:** SQLAlchemy 2.x, Alembic, psycopg2-binary, supabase-py, PostgreSQL 17 (Supabase)

---

## File Map

```
backend/
├── core/
│   └── config.py                    # MODIFY — add DATABASE_URL, SUPABASE_URL, SUPABASE_KEY
├── db/
│   ├── __init__.py                  # CREATE — empty
│   └── session.py                   # CREATE — SQLAlchemy engine + SessionLocal
├── models/
│   ├── __init__.py                  # CREATE — re-export all models
│   ├── base.py                      # CREATE — declarative Base
│   ├── users.py                     # CREATE — User, Organization, OrgMember
│   ├── billing.py                   # CREATE — Plan, Subscription, UsageEvent
│   ├── learning.py                  # CREATE — Problem, Submission, SkillSnapshot
│   └── content.py                   # CREATE — ChatSession, CurriculumPath, Prompt, UserSetting
├── seeds/
│   ├── __init__.py                  # CREATE — empty
│   ├── plans.py                     # CREATE — free plan seed
│   └── prompts.py                   # CREATE — 6 prompt templates
├── db/migrations/
│   ├── env.py                       # CREATE — Alembic env (imports all models)
│   ├── script.py.mako               # CREATE — Alembic template
│   └── versions/
│       └── 001_initial_schema.py    # CREATE — full 13-table migration
├── tests/
│   ├── test_db_connection.py        # CREATE — connectivity + table existence test
│   └── conftest.py                  # MODIFY — add db session fixture
├── .env.example                     # MODIFY — add DATABASE_URL, SUPABASE_URL, SUPABASE_KEY
└── alembic.ini                      # CREATE — Alembic config
```

---

### Task 1: Add dependencies and update config

**Files:**
- Modify: `backend/pyproject.toml` (via uv add)
- Modify: `backend/core/config.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add runtime dependencies**

```bash
cd /Users/sai/WS/help_me_code/backend
uv add sqlalchemy alembic supabase
```

- [ ] **Step 2: Update `backend/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CodeMentor API"
    debug: bool = False
    frontend_url: str = "http://localhost:3000"

    database_url: str = ""
    supabase_url: str = ""
    supabase_key: str = ""


settings = Settings()
```

- [ ] **Step 3: Update `backend/.env.example`**

```
APP_NAME=CodeMentor API
DEBUG=false
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_KEY=your_publishable_key_here
```

- [ ] **Step 4: Run ruff to verify no issues**

```bash
cd /Users/sai/WS/help_me_code/backend
uv run ruff check .
```

Expected: `All checks passed!`

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/core/config.py backend/.env.example
git commit -m "feat: add SQLAlchemy, Alembic, supabase deps and update config"
```

---

### Task 2: SQLAlchemy base and session

**Files:**
- Create: `backend/models/base.py`
- Create: `backend/db/__init__.py`
- Create: `backend/db/session.py`

- [ ] **Step 1: Create `backend/models/base.py`**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Create `backend/db/__init__.py`** (empty file)

- [ ] **Step 3: Create `backend/db/session.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: Verify import works**

```bash
cd /Users/sai/WS/help_me_code/backend
uv run python -c "from db.session import engine; print('engine OK:', engine.url.host)"
```

Expected: `engine OK: aws-0-us-west-2.pooler.supabase.com` (or similar pooler host)

- [ ] **Step 5: Commit**

```bash
git add backend/models/ backend/db/
git commit -m "feat: add SQLAlchemy declarative base and session factory"
```

---

### Task 3: Identity & Auth models (users, organizations, org_members)

**Files:**
- Create: `backend/models/users.py`

- [ ] **Step 1: Create `backend/models/users.py`**

```python
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from models.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    max_seats: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    members: Mapped[list["OrgMember"]] = relationship("OrgMember", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    profile_level: Mapped[str] = mapped_column(String, nullable=False)  # kid|student|engineer
    skill_level: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    xp_total: Mapped[int] = mapped_column(Integer, default=0)
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OrgMember(Base):
    __tablename__ = "org_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False)  # owner|admin|member
    invited_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    joined_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="members")
```

- [ ] **Step 2: Verify import**

```bash
uv run python -c "from models.users import User, Organization, OrgMember; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models/users.py
git commit -m "feat: add User, Organization, OrgMember SQLAlchemy models"
```

---

### Task 4: Billing models (plans, subscriptions, usage_events)

**Files:**
- Create: `backend/models/billing.py`

- [ ] **Step 1: Create `backend/models/billing.py`**

```python
import uuid
from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price_monthly: Mapped[float] = mapped_column(Float, default=0.0)
    price_yearly: Mapped[float] = mapped_column(Float, default=0.0)
    allowed_models: Mapped[list] = mapped_column(ARRAY(String), default=[])
    llm_calls_per_month: Mapped[int] = mapped_column(Integer, default=100)
    max_seats: Mapped[int] = mapped_column(Integer, default=1)
    features: Mapped[dict] = mapped_column(JSONB, default={})
    stripe_price_id: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)  # user|org
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    stripe_sub_id: Mapped[str | None] = mapped_column(String, nullable=True)
    current_period_start: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    llm_model: Mapped[str | None] = mapped_column(String, nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    prompt_name: Mapped[str | None] = mapped_column(String, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Verify import**

```bash
uv run python -c "from models.billing import Plan, Subscription, UsageEvent; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models/billing.py
git commit -m "feat: add Plan, Subscription, UsageEvent SQLAlchemy models"
```

---

### Task 5: Learning models (problems, submissions, skill_snapshots)

**Files:**
- Create: `backend/models/learning.py`

- [ ] **Step 1: Create `backend/models/learning.py`**

```python
import uuid
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)  # markdown
    language: Mapped[str] = mapped_column(String, nullable=False)  # python|sql
    difficulty: Mapped[str] = mapped_column(String, nullable=False)  # easy|medium|hard
    topic: Mapped[list] = mapped_column(ARRAY(String), default=[])
    examples: Mapped[dict] = mapped_column(JSONB, default={})
    constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="curated")  # curated|user|llm
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False)
    llm_review: Mapped[str | None] = mapped_column(Text, nullable=True)
    improved_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_model_used: Mapped[str | None] = mapped_column(String, nullable=True)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    solution_viewed: Mapped[bool] = mapped_column(Boolean, default=False)
    solution_level: Mapped[str | None] = mapped_column(String, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SkillSnapshot(Base):
    __tablename__ = "skill_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    trigger: Mapped[str] = mapped_column(String, nullable=False)  # submission|manual|scheduled
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Verify import**

```bash
uv run python -c "from models.learning import Problem, Submission, SkillSnapshot; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models/learning.py
git commit -m "feat: add Problem, Submission, SkillSnapshot SQLAlchemy models"
```

---

### Task 6: Content models (chat_sessions, curriculum_paths, prompts, user_settings)

**Files:**
- Create: `backend/models/content.py`
- Create: `backend/models/__init__.py`

- [ ] **Step 1: Create `backend/models/content.py`**

```python
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    problem_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id"), nullable=True
    )
    submission_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    session_type: Mapped[str] = mapped_column(String, nullable=False)  # teach_me|freeform
    messages: Mapped[list] = mapped_column(JSONB, default=[])
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CurriculumPath(Base):
    __tablename__ = "curriculum_paths"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    language: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    ordered_problem_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), default=[])
    target_level: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(default=1)
    template: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list] = mapped_column(ARRAY(String), default=[])
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserSetting(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    default_language: Mapped[str] = mapped_column(String, default="python")
    llm_model: Mapped[str] = mapped_column(String, default="anthropic/claude-sonnet-4-5")
    theme: Mapped[str] = mapped_column(String, default="dark")
    explain_style: Mapped[str] = mapped_column(String, default="technical")
    solution_level: Mapped[str] = mapped_column(String, default="learner")
    sidebar_prefs: Mapped[dict] = mapped_column(JSONB, default={})
```

- [ ] **Step 2: Create `backend/models/__init__.py`**

```python
from models.base import Base
from models.billing import Plan, Subscription, UsageEvent
from models.content import ChatSession, CurriculumPath, Prompt, UserSetting
from models.learning import Problem, SkillSnapshot, Submission
from models.users import OrgMember, Organization, User

__all__ = [
    "Base",
    "User",
    "Organization",
    "OrgMember",
    "Plan",
    "Subscription",
    "UsageEvent",
    "Problem",
    "Submission",
    "SkillSnapshot",
    "ChatSession",
    "CurriculumPath",
    "Prompt",
    "UserSetting",
]
```

- [ ] **Step 3: Verify all models import cleanly**

```bash
uv run python -c "from models import Base, User, Organization, OrgMember, Plan, Subscription, UsageEvent, Problem, Submission, SkillSnapshot, ChatSession, CurriculumPath, Prompt, UserSetting; print('All 13 models OK')"
```

Expected: `All 13 models OK`

- [ ] **Step 4: Commit**

```bash
git add backend/models/content.py backend/models/__init__.py
git commit -m "feat: add content models and models __init__ (all 13 tables defined)"
```

---

### Task 7: Alembic setup and initial migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/db/migrations/env.py`
- Create: `backend/db/migrations/script.py.mako`
- Create: `backend/db/migrations/versions/001_initial_schema.py`

- [ ] **Step 1: Initialise Alembic inside `backend/`**

```bash
cd /Users/sai/WS/help_me_code/backend
uv run alembic init db/migrations
```

This creates `alembic.ini` and `db/migrations/` scaffold.

- [ ] **Step 2: Update `backend/alembic.ini` — set script location and comment out sqlalchemy.url (we set it in env.py)**

Find and replace these two lines in `alembic.ini`:

```ini
script_location = db/migrations
```

And comment out the url line:
```ini
# sqlalchemy.url = driver://user:pass@localhost/dbname
```

- [ ] **Step 3: Replace `backend/db/migrations/env.py` with this content**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from core.config import settings
from models import Base  # noqa: F401 — imports all models for autogenerate

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Generate the migration via autogenerate**

```bash
cd /Users/sai/WS/help_me_code/backend
uv run alembic revision --autogenerate -m "initial_schema"
```

Expected: creates a file in `db/migrations/versions/` like `xxxx_initial_schema.py`

- [ ] **Step 5: Review the generated migration**

Open the generated file and verify it contains `CREATE TABLE` statements for all 13 tables:
- `organizations`, `users`, `org_members`
- `plans`, `subscriptions`, `usage_events`
- `problems`, `submissions`, `skill_snapshots`
- `chat_sessions`, `curriculum_paths`, `prompts`, `user_settings`

If any table is missing, check that its model is imported in `models/__init__.py`.

- [ ] **Step 6: Run the migration**

```bash
uv run alembic upgrade head
```

Expected: `Running upgrade  -> xxxx, initial_schema` with no errors.

- [ ] **Step 7: Verify tables exist in Supabase**

```bash
uv run python -c "
from sqlalchemy import inspect
from db.session import engine
inspector = inspect(engine)
tables = sorted(inspector.get_table_names())
print('Tables created:', len(tables))
for t in tables:
    print(' -', t)
"
```

Expected: 13+ tables listed (plus `alembic_version`).

- [ ] **Step 8: Commit**

```bash
git add backend/alembic.ini backend/db/migrations/
git commit -m "feat: add Alembic setup and initial 13-table schema migration"
```

---

### Task 8: Seed data (plans + prompts)

**Files:**
- Create: `backend/seeds/__init__.py`
- Create: `backend/seeds/plans.py`
- Create: `backend/seeds/prompts.py`

- [ ] **Step 1: Create `backend/seeds/__init__.py`** (empty)

- [ ] **Step 2: Create `backend/seeds/plans.py`**

```python
from db.session import SessionLocal
from models.billing import Plan


def seed_plans() -> None:
    db = SessionLocal()
    try:
        if db.query(Plan).count() > 0:
            print("Plans already seeded, skipping.")
            return

        free_plan = Plan(
            name="Free",
            price_monthly=0.0,
            price_yearly=0.0,
            allowed_models=["anthropic/claude-sonnet-4-5", "google/gemini-2.0-flash", "meta-llama/llama-3.3-70b"],
            llm_calls_per_month=50,
            max_seats=1,
            features={"code_review": True, "hints": True, "teach_me": True, "surprise_me": True},
            is_active=True,
        )
        pro_plan = Plan(
            name="Pro",
            price_monthly=12.0,
            price_yearly=99.0,
            allowed_models=["anthropic/claude-sonnet-4-5", "openai/gpt-4o", "google/gemini-2.0-flash", "meta-llama/llama-3.3-70b"],
            llm_calls_per_month=500,
            max_seats=1,
            features={"code_review": True, "hints": True, "teach_me": True, "surprise_me": True, "advanced_models": True},
            is_active=True,
        )
        db.add_all([free_plan, pro_plan])
        db.commit()
        print("Seeded 2 plans.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_plans()
```

- [ ] **Step 3: Create `backend/seeds/prompts.py`**

```python
from db.session import SessionLocal
from models.content import Prompt


PROMPTS = [
    {
        "name": "code_review",
        "version": 1,
        "variables": ["code", "language", "problem", "user_level"],
        "template": """You are an expert {language} developer reviewing code submitted by a {user_level}-level learner.

Problem: {problem}

Submitted code:
```{language}
{code}
```

Provide your review in this exact structure:

## Issues Found
List each issue with a brief explanation suited to a {user_level}-level learner.

## Improved Code
```{language}
[provide the improved, complete code here]
```

## Why This Is Better
Explain the improvements in language appropriate for a {user_level}-level learner. Be encouraging.""",
    },
    {
        "name": "hint_generator",
        "version": 1,
        "variables": ["problem", "code_so_far", "hint_number", "user_level"],
        "template": """You are helping a {user_level}-level learner solve a coding problem. Give hint #{hint_number} of 3.

Problem: {problem}

Their code so far:
{code_so_far}

Rules:
- NEVER give away the solution or the key algorithm
- Hint 1: point toward the right approach conceptually
- Hint 2: suggest a specific technique or data structure
- Hint 3: give a concrete nudge — still no solution
- Adapt language for a {user_level}-level learner

Give only the hint, nothing else.""",
    },
    {
        "name": "solution_generator",
        "version": 1,
        "variables": ["problem", "language", "solution_level", "user_level"],
        "template": """You are an expert {language} developer. Provide a {solution_level} solution for this problem.

Problem: {problem}

Solution levels:
- beginner: simple, heavily commented, avoids advanced constructs
- learner: clean, idiomatic, follows best practices
- industry_standard: production-quality, handles edge cases and errors
- optimal_time: best time complexity, may sacrifice readability
- optimal_space: best space complexity
- interview_ready: what a senior engineer writes in a real interview

Provide the {solution_level} solution in {language}. Include brief comments explaining key decisions.""",
    },
    {
        "name": "teach_me",
        "version": 1,
        "variables": ["code", "explain_style", "user_level", "language"],
        "template": """You are teaching a {user_level}-level learner to understand this {language} code.

Code:
```{language}
{code}
```

Explanation style: {explain_style}
- technical: use proper CS terminology and concepts
- simple: use plain language and analogies
- eli5: explain like the learner is 10 years old

Go through the code line by line (or block by block for larger code). For each part:
1. What it does
2. Why it's written this way
3. Any gotchas or alternatives

Keep the tone encouraging and matched to a {user_level}-level learner.""",
    },
    {
        "name": "surprise_me",
        "version": 1,
        "variables": ["language", "user_skill_level", "topic_focus", "avoid_recent_ids"],
        "template": """Generate a coding problem for a {user_skill_level}-level {language} programmer.

Topic focus (if specified): {topic_focus}
Recently solved problem IDs to avoid: {avoid_recent_ids}

Return ONLY valid JSON in this exact schema:
{{
  "title": "Problem title",
  "description": "Full problem description in markdown. Include context, requirements, and constraints.",
  "difficulty": "easy|medium|hard",
  "topic": ["array of", "relevant topics"],
  "examples": {{
    "input": "example input",
    "output": "expected output",
    "explanation": "why this is the output"
  }},
  "constraints": "Time/space complexity expectations or input size constraints"
}}

The difficulty should match skill level {user_skill_level} (1=beginner, 5=expert).""",
    },
    {
        "name": "skill_assessor",
        "version": 1,
        "variables": ["recent_submissions", "current_level"],
        "template": """You are assessing a programmer's skill level based on their recent submissions.

Current assessed level: {current_level} (scale 1.0–5.0)

Recent submissions (most recent first):
{recent_submissions}

Analyze the code quality, problem-solving approach, and patterns across submissions.

Return ONLY valid JSON:
{{
  "level": 2.5,
  "weak": ["list of weak areas identified, e.g. 'list comprehensions', 'error handling'"],
  "next": ["list of recommended topics to study next"],
  "summary": "One sentence assessment of the learner's current abilities"
}}""",
    },
]


def seed_prompts() -> None:
    db = SessionLocal()
    try:
        if db.query(Prompt).count() > 0:
            print("Prompts already seeded, skipping.")
            return

        prompts = [Prompt(**p) for p in PROMPTS]
        db.add_all(prompts)
        db.commit()
        print(f"Seeded {len(prompts)} prompts.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_prompts()
```

- [ ] **Step 4: Run the seeds**

```bash
cd /Users/sai/WS/help_me_code/backend
uv run python -m seeds.plans
uv run python -m seeds.prompts
```

Expected:
```
Seeded 2 plans.
Seeded 6 prompts.
```

- [ ] **Step 5: Verify seeded data**

```bash
uv run python -c "
from db.session import SessionLocal
from models.billing import Plan
from models.content import Prompt
db = SessionLocal()
print('Plans:', db.query(Plan).count())
print('Prompts:', db.query(Prompt).count())
for p in db.query(Prompt).all():
    print(' -', p.name)
db.close()
"
```

Expected: `Plans: 2`, `Prompts: 6` with all 6 names listed.

- [ ] **Step 6: Commit**

```bash
git add backend/seeds/
git commit -m "feat: add seed data for plans and prompts"
```

---

### Task 9: Tests

**Files:**
- Create: `backend/tests/test_db_connection.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Update `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db.session import SessionLocal
from main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db() -> Session:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 2: Create `backend/tests/test_db_connection.py`**

```python
from sqlalchemy import inspect, text

from db.session import engine

EXPECTED_TABLES = {
    "users",
    "organizations",
    "org_members",
    "plans",
    "subscriptions",
    "usage_events",
    "problems",
    "submissions",
    "skill_snapshots",
    "chat_sessions",
    "curriculum_paths",
    "prompts",
    "user_settings",
}


def test_database_is_reachable():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


def test_all_tables_exist():
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    missing = EXPECTED_TABLES - existing
    assert not missing, f"Missing tables: {missing}"


def test_plans_seeded(db):
    from models.billing import Plan
    count = db.query(Plan).count()
    assert count >= 2, f"Expected at least 2 plans, got {count}"


def test_prompts_seeded(db):
    from models.content import Prompt
    expected_names = {
        "code_review", "hint_generator", "solution_generator",
        "teach_me", "surprise_me", "skill_assessor",
    }
    existing = {p.name for p in db.query(Prompt).all()}
    missing = expected_names - existing
    assert not missing, f"Missing prompts: {missing}"
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/sai/WS/help_me_code/backend
uv run pytest -v
```

Expected: 5 tests pass (1 health + 4 DB tests).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: add database connectivity and schema verification tests"
```

---

### Task 10: Update PROGRESS.md and open PR

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Update `PROGRESS.md`**

```markdown
# CodeMentor — Progress

## Current Status
Phase 2 (Database Schema) complete. All 13 tables live in Supabase. Plans and prompts seeded. Ready for Phase 3: Backend Core API endpoints.

## Completed
- [2026-05-15] Design spec approved (`docs/superpowers/specs/2026-05-15-codementor-design.md`)
- [2026-05-15] Phase 1: Project scaffold — FastAPI backend, Next.js frontend, Makefile, README
- [2026-05-15] Phase 2: Database schema
  - SQLAlchemy models for all 13 tables (4 groups: identity, billing, learning, content)
  - Alembic migration applied to Supabase PostgreSQL 17
  - Seeded: 2 plans (Free, Pro), 6 prompt templates
  - 5 tests passing (health + 4 DB verification tests)

## In Progress
- Phase 3: Backend Core API endpoints

## Next Steps
1. Create branch `feat/backend-core`
2. Implement CRUD endpoints for problems (`GET /problems`, `GET /problems/{id}`)
3. Implement user profile endpoint (`GET /users/me`)
4. Implement submissions endpoint (`POST /submissions`)
5. Wire Pydantic response schemas for all endpoints
6. Add pagination to problem list
7. Open PR → merge → Phase 4 (Auth)

## Blockers
- None
```

- [ ] **Step 2: Run full test suite one final time**

```bash
cd /Users/sai/WS/help_me_code
make test
```

Expected: all tests pass.

- [ ] **Step 3: Commit and push**

```bash
git add PROGRESS.md
git commit -m "docs: update PROGRESS.md for Phase 2 completion"
git push -u origin feat/database-schema
```

- [ ] **Step 4: Open PR**

Title: `feat: Phase 2 — database schema (13 tables, Alembic, seed data)`

PR body should note:
- SQLAlchemy models for all 13 tables across 4 domain groups
- Alembic migration applied to Supabase
- Seed data: 2 plans, 6 LLM prompt templates
- 5 passing tests (health + DB connectivity + schema verification + seed verification)

- [ ] **Step 5: Prompt user to review and merge before starting Phase 3**
