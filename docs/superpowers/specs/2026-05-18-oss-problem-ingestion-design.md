# OSS Problem Ingestion Pipeline

**Date:** 2026-05-18
**Goal:** Add 200+ beginner-friendly Python problems from open-source repos into the CodeMentor DB, ordered by difficulty, deduplicating against existing content.

---

## Problem Statement

The current 112 problems are sourced from LeetCode (function-based, algorithmic). They skew medium/hard and are inappropriate for absolute beginners or children. Problems also have no explicit sort order, so the frontend cannot surface easiest-first without relying on the free-text difficulty field.

---

## Sources

| Source | Exercises | Difficulty | Style |
|---|---|---|---|
| `exercism/python` | 140 | 1–10 (use 1–5) | function-based, high quality |
| `4GeeksAcademy/python-beginner-programming-exercises` | 22 | beginner | stdin/stdout |
| `4GeeksAcademy/python-lists-loops-programming-exercises` | 46 | beginner | stdin/stdout |
| `4GeeksAcademy/python-functions-programming-exercises` | 11 | beginner | stdin/stdout |
| `4GeeksAcademy/master-python-programming-exercises` | 48 | beginner-intermediate | stdin/stdout |
| Curated hardcoded list | 25 | absolute beginner | stdin/stdout |

**Expected yield after dedup:** ~200–230 net new problems.

---

## DB Change

Add `sort_order INTEGER` column to `problems` table via Alembic migration.

```python
# Migration
op.add_column('problems', sa.Column('sort_order', sa.Integer(), nullable=True))
op.create_index('ix_problems_sort_order', 'problems', ['sort_order'])
```

Update existing 112 problems to `sort_order = 1000 + external_id` (preserves relative LeetCode ordering, above all new content).

### Sort Order Scheme

| Range | Source | Difficulty |
|---|---|---|
| 1–25 | Curated hardcoded | easy (absolute beginner) |
| 100–299 | 4GeeksAcademy | easy |
| 300–499 | Exercism difficulty 1–2 | easy |
| 500–799 | Exercism difficulty 3–5 | medium |
| 1000+ | Existing LeetCode problems | easy/medium/hard (unchanged) |

---

## Pipeline Architecture

### Scripts

```
backend/seeds/
  ingest_oss.py            # main entry point (CLI)
  scrapers/
    exercism.py            # clone + parse exercism/python
    four_geeks.py          # clone + parse 4GeeksAcademy repos
    curated.py             # hardcoded 25 beginner problems
  data/
    oss_problems.json      # output checkpoint (reviewable before insert)
```

One Alembic migration:
```
backend/db/migrations/versions/XXXX_add_sort_order_to_problems.py
```

### Flow

```
1. git clone repos → /tmp/hmc_scrape/
2. Parse each source into intermediate dicts
3. Deduplicate against existing problems + within new batch
4. Enrich: assign sort_order, map difficulty, clean markdown
5. Write → backend/seeds/data/oss_problems.json
6. [User reviews JSON]
7. python -m seeds.ingest_oss --insert → bulk insert to DB
```

---

## Parsing Details

### Exercism

- **Metadata:** `config.json` at repo root → `exercises.practice[]` entries with `slug`, `difficulty`, `blurb`, `topics`
- **Description:** `.docs/instructions.md` (remove `# Instructions` header, clean up exercism-specific refs)
- **Solution:** `.meta/example.py`
- **Examples:** Parse `*_test.py` test file, extract `@pytest.mark.parametrize` fixtures → take first 2–3 as display examples
- **Difficulty filter:** Only include exercises with difficulty ≤ 5

### 4GeeksAcademy

- **Description:** `exercises/{name}/README.md` → strip YAML frontmatter, strip image refs, keep instructional text
- **Solution:** `exercises/{name}/solution.hide.py`
- **Examples:** Derive from solution (run the solution with sample inputs where deterministic, or extract from README)
- **Difficulty:** All mapped to `easy`

### Curated List

25 hand-written problems covering:
- Hello World variants
- Basic arithmetic (add, subtract, multiply)
- String operations (reverse, uppercase, count chars)
- Conditionals (odd/even, positive/negative, FizzBuzz)
- Loops (sum 1 to N, countdown, multiplication table)
- Lists (max, min, sort, find item)
- Temperature conversion, area/perimeter calculations

All in stdin/stdout style with 3 concrete I/O examples each.

---

## Deduplication

1. **Slug collision:** New `slug` in set of existing slugs → skip
2. **Title fuzzy match:** `SequenceMatcher(None, a.lower(), b.lower()).ratio() > 0.82` against existing titles → skip
3. **Within-batch dedup:** Same slug check across all three sources

Existing `enriched_problems.json` (112 problems) serves as the dedup baseline loaded at startup.

---

## Problem Format

```json
{
  "title": "Leap Year",
  "slug": "leap-year",
  "description": "Given a year, check if it is a leap year...",
  "difficulty": "easy",
  "language": "python",
  "topic": ["math", "conditionals"],
  "examples": [
    {"input": "2000", "output": "True"},
    {"input": "1900", "output": "False"},
    {"input": "2024", "output": "True"}
  ],
  "constraints": "1900 ≤ year ≤ 2100",
  "source": "imported",
  "source_url": "https://exercism.org/tracks/python/exercises/leap",
  "is_published": true,
  "sort_order": 312
}
```

---

## Make Targets

```makefile
scrape-oss:    ## Clone repos and parse into oss_problems.json (dry run)
insert-oss:    ## Insert oss_problems.json into DB (run after reviewing)
```

---

## Success Criteria

- [ ] `sort_order` column added and existing 112 problems updated
- [ ] `backend/seeds/data/oss_problems.json` generated with 200+ problems
- [ ] No duplicates (slug or fuzzy title match) against existing problems
- [ ] All problems have `difficulty`, `topic[]`, `examples[]` (min 2), `sort_order`
- [ ] `make scrape-oss` runs cleanly from a fresh checkout
- [ ] `make insert-oss` inserts problems idempotently (skip existing slugs)
- [ ] Frontend problems list shows easiest-first when sorted by `sort_order`
