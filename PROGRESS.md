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
  - 5 tests passing (health + DB connectivity + schema + seed verification)

## In Progress
- Phase 3: Backend Core API endpoints

## Next Steps
1. Create branch `feat/backend-core`
2. Add Pydantic response schemas for problems, submissions, users
3. Implement `GET /problems` (paginated, filtered by language/difficulty/topic)
4. Implement `GET /problems/{id}`
5. Implement `POST /submissions` (creates submission record)
6. Implement `GET /users/me` (current user profile)
7. Wire `get_db` dependency into all endpoints
8. Open PR → merge → Phase 4 (Auth)

## Blockers
- None
