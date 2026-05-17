# Problem Dataset — Design Spec
**Date:** 2026-05-16  
**Status:** Approved

---

## Goal

Seed the database with ~300 Python algorithm problems scraped from an external GitHub repository, enriched with LLM-classified topic tags, and stored in a source-agnostic schema that supports future problem sources (manual curation, LLM generation, user submission).

---

## Schema Changes

### 1. Extend `Problem` model (3 new columns)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `slug` | `String \| None` | `null` | URL-friendly identifier, e.g. `maximum-subarray`. Unique index per language. |
| `external_id` | `Integer \| None` | `null` | Problem number from any external source. Nullable — not all problems come from numbered sources. |
| `source_url` | `String \| None` | `null` | Link to original problem page. Null for internally authored problems. |
| `hints` | `JSONB \| None` | `null` | Ordered list of hint strings, e.g. `["Think about prefix sums", "Can you do it in O(N)?"]`. Powers the Hints tab without an LLM call. |

**Existing `source` field** gains a new allowed value: `imported` (alongside `curated`, `user`, `llm`).

**Full `problems` table columns:**
`id`, `title`, `slug`, `description`, `difficulty`, `language`, `topic`, `examples`, `constraints`, `hints`, `external_id`, `source_url`, `source`, `created_by`, `org_id`, `is_published`, `created_at`

### 2. New `ProblemSolution` model

Table: `problem_solutions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `problem_id` | UUID FK → `problems.id` | Cascade delete |
| `language` | str | `python` / `javascript` / `sql` / etc. |
| `variant` | str | `original` / `brute_force` / `optimal` / `clean` |
| `code` | Text | The solution code |
| `time_complexity` | str \| None | e.g. `O(N log N)` |
| `space_complexity` | str \| None | e.g. `O(1)` |
| `explanation` | Text \| None | One-paragraph approach summary |
| `is_primary` | bool | `true` = recommended solution to show by default |
| `created_at` | datetime | |

**Design rationale:** one problem → many solutions. The `Problem` row holds the question (description, examples, metadata). `ProblemSolution` rows hold answers. This avoids duplicating problem text per variant and keeps `GET /problems/{id}` lean. Works for all future sources: staff-authored solutions, community solutions, LLM-generated variants.

---

## Scraping Pipeline

Source: `github.com/Garvit244/Leetcode` (Python solutions, ~300 problems across 10 difficulty-grouped directories).

### Stage 1 — Scrape (Agent A)

1. Fetch `README.md` and parse every markdown table row: `(external_id, title, difficulty, source_url)`
2. For each problem, fetch the `.py` file via GitHub API
3. Parse the leading docstring to extract:
   - `description` — full problem statement
   - `examples` — structured as `[{input, output, explanation}]`
   - `constraints` — any constraint notes
4. Extract solution code (everything after the docstring)
5. Parse trailing comments for `time_complexity` / `space_complexity` (pattern: `# Time: O(...)`)
6. Output: `backend/seeds/data/raw_problems.json`

### Stage 2 — LLM Topic Classification (Agent B, after Stage 1)

- Feed problem descriptions to Claude in batches of 25
- Assign tags from a fixed vocabulary:
  `array`, `string`, `hash-map`, `two-pointers`, `sliding-window`, `binary-search`, `linked-list`, `stack`, `queue`, `tree`, `graph`, `dynamic-programming`, `greedy`, `backtracking`, `math`, `bit-manipulation`, `heap`, `sorting`
- Each problem gets 1–4 tags
- Output: `backend/seeds/data/enriched_problems.json`

### Stage 3 — Schema + Migration (Agent C, parallel with A)

1. Update `backend/models/learning.py` — add 4 new columns to `Problem`, add `ProblemSolution` model
2. Update `backend/schemas/problem.py` — add fields to `ProblemOut`, add `ProblemSolutionOut` schema
3. Write Alembic migration

### Stage 4 — Seed Script (Agent D, after B + C)

- Reads `enriched_problems.json`
- Inserts `Problem` rows (skips if `external_id` + `language` already exists)
- Inserts one `ProblemSolution` row per problem (`variant=original`, `is_primary=true`)
- Entry point: `python -m seeds.problems_dataset`

---

## Solution Variants — Lazy Generation

**Only `variant=original` is seeded upfront** (the code from the source repo).

Additional variants (`optimal`, `clean`) are generated on demand:
- New endpoint: `POST /problems/{id}/solutions/generate?variant=optimal`
- Checks if the variant already exists in `problem_solutions` → returns cached if so
- Otherwise calls LLM, inserts the new row, returns result
- This keeps seeding fast and LLM costs demand-driven

---

## Execution Order

```
Agent A (scrape)  ──────────────────────────────────────────────────→ raw_problems.json
Agent C (schema)  ────────→ models + migration
                                                  Agent B (LLM tags) → enriched_problems.json
                                                  Agent D (seed script, after B+C)
```

Agents A and C run in parallel. B starts after A. D starts after B and C.

---

## Files Touched

| File | Change |
|------|--------|
| `backend/models/learning.py` | Add columns to `Problem`; add `ProblemSolution` model |
| `backend/schemas/problem.py` | Update `ProblemOut`; add `ProblemSolutionOut` |
| `backend/db/migrations/versions/xxxx_problem_dataset.py` | New Alembic migration |
| `backend/seeds/data/raw_problems.json` | Scraper output (gitignored) |
| `backend/seeds/data/enriched_problems.json` | Enricher output (gitignored) |
| `backend/seeds/problems_dataset.py` | New seed script |
| `backend/api/problems.py` | Add `POST /problems/{id}/solutions/generate` endpoint |

---

## Out of Scope

- Generating `optimal` / `clean` variants upfront (lazy, on demand)
- Multi-language solutions (Python only for this dataset)
- Test case / judge integration (not planned)
- User-submitted problems (existing `source=user` path handles this separately)
