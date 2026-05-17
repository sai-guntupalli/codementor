# Problem Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed ~300 Python algorithm problems into the database with full metadata, LLM-assigned topic tags, and original solution code; add a `ProblemSolution` table and a lazy endpoint for generating additional solution variants on demand.

**Architecture:** Four sequential stages: (1) scrape GitHub repo → `raw_problems.json`, (2) LLM topic classification in batches → `enriched_problems.json`, (3) schema/migration/API changes land independently of the scraping stages, (4) seed script inserts enriched data. A new `POST /problems/{id}/solutions/generate` endpoint generates and caches `optimal`/`clean` variants lazily.

**Tech Stack:** Python 3.12, SQLAlchemy 2, Alembic, httpx (sync for seed scripts), FastAPI async, PostgreSQL/Supabase, OpenRouter API, pytest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/.gitignore` | Modify | Ignore `seeds/data/` JSON files |
| `backend/models/learning.py` | Modify | Add 4 cols to `Problem`; add `ProblemSolution` model |
| `backend/db/migrations/versions/xxxx_problem_dataset.py` | Create | Alembic migration for new columns + table |
| `backend/schemas/problem.py` | Modify | Add new fields to `ProblemOut`; add `ProblemSolutionOut` |
| `backend/seeds/scraper.py` | Create | Parse GitHub repo README + .py files → `raw_problems.json` |
| `backend/seeds/enrich.py` | Create | LLM topic classification → `enriched_problems.json` |
| `backend/seeds/problems_dataset.py` | Create | Insert enriched JSON into DB |
| `backend/api/problems.py` | Modify | Add `POST /problems/{id}/solutions/generate` endpoint |
| `backend/tests/test_scraper.py` | Create | Unit tests for parser functions |
| `backend/tests/test_problems.py` | Modify | Tests for new model fields + lazy endpoint |

---

## Task 1: Ignore Seed Data Files

**Files:**
- Modify: `backend/.gitignore`

- [ ] **Step 1: Add seed data directory to .gitignore**

Append to `backend/.gitignore`:
```
# Seed pipeline data (large, generated)
seeds/data/
```

- [ ] **Step 2: Create the directory with a placeholder**

```bash
mkdir -p backend/seeds/data
touch backend/seeds/data/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add backend/.gitignore backend/seeds/data/.gitkeep
git commit -m "chore: ignore seeds/data generated JSON files"
```

---

## Task 2: Extend Problem Model + Add ProblemSolution Model

**Files:**
- Modify: `backend/models/learning.py`
- Modify: `backend/tests/test_problems.py`

- [ ] **Step 1: Write failing tests for new model fields**

Add to `backend/tests/test_problems.py`:
```python
def test_problem_has_new_fields():
    from models.learning import Problem
    assert hasattr(Problem, "slug")
    assert hasattr(Problem, "external_id")
    assert hasattr(Problem, "source_url")
    assert hasattr(Problem, "hints")


def test_problem_solution_model_exists():
    from models.learning import ProblemSolution
    assert hasattr(ProblemSolution, "problem_id")
    assert hasattr(ProblemSolution, "variant")
    assert hasattr(ProblemSolution, "code")
    assert hasattr(ProblemSolution, "is_primary")
    assert hasattr(ProblemSolution, "time_complexity")
    assert hasattr(ProblemSolution, "space_complexity")
    assert hasattr(ProblemSolution, "explanation")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_problems.py::test_problem_has_new_fields tests/test_problems.py::test_problem_solution_model_exists -v
```
Expected: FAILED — `ImportError` or `AttributeError`

- [ ] **Step 3: Extend Problem model and add ProblemSolution**

Replace the `Problem` class and add `ProblemSolution` in `backend/models/learning.py`:
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
    slug: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False)
    topic: Mapped[list] = mapped_column(ARRAY(String), default=[])
    examples: Mapped[list] = mapped_column(JSONB, default=[])
    constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    hints: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    external_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="curated")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProblemSolution(Base):
    __tablename__ = "problem_solutions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    language: Mapped[str] = mapped_column(String, nullable=False)
    variant: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    time_complexity: Mapped[str | None] = mapped_column(String, nullable=True)
    space_complexity: Mapped[str | None] = mapped_column(String, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Submission(Base):
    # ... keep existing Submission and SkillSnapshot unchanged
```

> **Note:** Keep the existing `Submission` and `SkillSnapshot` classes below `ProblemSolution` — do not remove them.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && uv run pytest tests/test_problems.py::test_problem_has_new_fields tests/test_problems.py::test_problem_solution_model_exists -v
```
Expected: PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/models/learning.py backend/tests/test_problems.py
git commit -m "feat(models): add ProblemSolution table and extend Problem with slug/external_id/source_url/hints"
```

---

## Task 3: Write and Apply Alembic Migration

**Files:**
- Create: `backend/db/migrations/versions/<hash>_problem_dataset.py`

- [ ] **Step 1: Generate migration from model diff**

```bash
cd backend && uv run alembic revision --autogenerate -m "problem_dataset"
```
Expected: Creates `db/migrations/versions/<hash>_problem_dataset.py`

- [ ] **Step 2: Review the generated migration**

Open the generated file. Verify it contains:
- `op.add_column('problems', sa.Column('slug', ...))`
- `op.add_column('problems', sa.Column('external_id', ...))`
- `op.add_column('problems', sa.Column('source_url', ...))`
- `op.add_column('problems', sa.Column('hints', ...))`
- `op.create_table('problem_solutions', ...)`

If any are missing, add them manually. The migration `upgrade()` should look like:
```python
def upgrade() -> None:
    op.add_column("problems", sa.Column("slug", sa.String(), nullable=True))
    op.add_column("problems", sa.Column("external_id", sa.Integer(), nullable=True))
    op.add_column("problems", sa.Column("source_url", sa.String(), nullable=True))
    op.add_column("problems", sa.Column("hints", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index("ix_problems_slug", "problems", ["slug"])
    op.create_index("ix_problems_external_id", "problems", ["external_id"])

    op.create_table(
        "problem_solutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(), nullable=False),
        sa.Column("variant", sa.String(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("time_complexity", sa.String(), nullable=True),
        sa.Column("space_complexity", sa.String(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_problem_solutions_problem_id", "problem_solutions", ["problem_id"])


def downgrade() -> None:
    op.drop_index("ix_problem_solutions_problem_id")
    op.drop_table("problem_solutions")
    op.drop_index("ix_problems_external_id")
    op.drop_index("ix_problems_slug")
    op.drop_column("problems", "hints")
    op.drop_column("problems", "source_url")
    op.drop_column("problems", "external_id")
    op.drop_column("problems", "slug")
```

- [ ] **Step 3: Apply the migration**

```bash
cd backend && uv run alembic upgrade head
```
Expected: `Running upgrade <prev_hash> -> <new_hash>, problem_dataset`

- [ ] **Step 4: Verify in DB**

```bash
cd backend && uv run python -c "
from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
result = db.execute(text(\"SELECT column_name FROM information_schema.columns WHERE table_name='problems' AND column_name IN ('slug','external_id','source_url','hints')\")).fetchall()
print('New problem cols:', [r[0] for r in result])
result2 = db.execute(text(\"SELECT table_name FROM information_schema.tables WHERE table_name='problem_solutions'\")).fetchone()
print('problem_solutions table:', result2)
db.close()
"
```
Expected:
```
New problem cols: ['slug', 'external_id', 'source_url', 'hints']
problem_solutions table: ('problem_solutions',)
```

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/versions/
git commit -m "feat(migration): add problem_solutions table and new Problem columns"
```

---

## Task 4: Update Pydantic Schemas

**Files:**
- Modify: `backend/schemas/problem.py`

- [ ] **Step 1: Write failing test for new schema fields**

Add to `backend/tests/test_problems.py`:
```python
def test_problem_out_has_new_fields():
    from schemas.problem import ProblemOut
    fields = ProblemOut.model_fields
    assert "slug" in fields
    assert "external_id" in fields
    assert "source_url" in fields
    assert "hints" in fields


def test_problem_solution_out_schema():
    from schemas.problem import ProblemSolutionOut
    fields = ProblemSolutionOut.model_fields
    assert "problem_id" in fields
    assert "variant" in fields
    assert "code" in fields
    assert "is_primary" in fields
    assert "time_complexity" in fields
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_problems.py::test_problem_out_has_new_fields tests/test_problems.py::test_problem_solution_out_schema -v
```
Expected: FAILED

- [ ] **Step 3: Update `backend/schemas/problem.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class ProblemOut(BaseModel):
    id: uuid.UUID
    title: str
    slug: str | None
    description: str
    language: str
    difficulty: str
    topic: list[str]
    examples: list[dict]
    constraints: str | None
    hints: list[str] | None
    external_id: int | None
    source_url: str | None
    source: str
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemListOut(BaseModel):
    items: list[ProblemOut]
    total: int
    page: int
    page_size: int


class ProblemSolutionOut(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    language: str
    variant: str
    code: str
    time_complexity: str | None
    space_complexity: str | None
    explanation: str | None
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && uv run pytest tests/test_problems.py::test_problem_out_has_new_fields tests/test_problems.py::test_problem_solution_out_schema -v
```
Expected: PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/schemas/problem.py backend/tests/test_problems.py
git commit -m "feat(schemas): add ProblemSolutionOut and new fields to ProblemOut"
```

---

## Task 5: Write Scraper Parser Functions (with Tests)

**Files:**
- Create: `backend/seeds/scraper.py` (parser functions only, no network calls)
- Create: `backend/tests/test_scraper.py`

- [ ] **Step 1: Write failing tests for parser functions**

Create `backend/tests/test_scraper.py`:
```python
from seeds.scraper import make_slug, parse_py_file, parse_readme

SAMPLE_README = """
| # | Title | Solution | Difficulty |
|---| ----- | -------- | ---------- |
|53|[Maximum Subarray](https://example.com/problems/maximum-subarray/)|[Python](./1-100q/53.py)|Easy|
|4|[Median of Two Sorted Arrays](https://example.com/problems/median-of-two-sorted-arrays/)|[Python](./1-100q/4.py)|Hard|
|70|[Climbing Stairs](https://example.com/problems/climbing-stairs/)|[Python](./1-100q/70.py)|Easy|
"""

SAMPLE_PY = """'''
\tGiven an integer array nums, find the contiguous subarray (containing at least one number)
\twhich has the largest sum and return its sum.

\tExample:

\tInput: [-2,1,-3,4,-1,2,1,-5,4],
\tOutput: 6
\tExplanation: [4,-1,2,1] has the largest sum = 6.

\tNote: If you have figured out the O(n) solution, try coding another solution using
\tthe divide and conquer approach, which is more subtle.
'''

class Solution(object):
    def maxSubArray(self, nums):
        currSum, result = nums[0], nums[0]
        for i in range(1, len(nums)):
            currSum = max(nums[i], currSum + nums[i])
            result = max(result, currSum)
        return result

# Time: O(N)
# Space: O(1)
"""

SAMPLE_PY_NO_DOCSTRING = """
class Solution(object):
    def solve(self):
        return 42
"""


def test_parse_readme_extracts_title():
    result = parse_readme(SAMPLE_README)
    assert 53 in result
    assert result[53]["title"] == "Maximum Subarray"


def test_parse_readme_extracts_difficulty():
    result = parse_readme(SAMPLE_README)
    assert result[53]["difficulty"] == "easy"
    assert result[4]["difficulty"] == "hard"


def test_parse_readme_extracts_file_path():
    result = parse_readme(SAMPLE_README)
    assert result[53]["file_path"] == "1-100q/53.py"


def test_parse_readme_extracts_source_url():
    result = parse_readme(SAMPLE_README)
    assert "maximum-subarray" in result[53]["source_url"]


def test_parse_py_file_extracts_description():
    result = parse_py_file(SAMPLE_PY)
    assert "largest sum" in result["description"]
    assert len(result["description"]) > 20


def test_parse_py_file_extracts_example():
    result = parse_py_file(SAMPLE_PY)
    assert len(result["examples"]) >= 1
    assert result["examples"][0]["input"] != ""
    assert result["examples"][0]["output"] != ""


def test_parse_py_file_extracts_complexity():
    result = parse_py_file(SAMPLE_PY)
    assert result["time_complexity"] == "O(N)"
    assert result["space_complexity"] == "O(1)"


def test_parse_py_file_extracts_solution_code():
    result = parse_py_file(SAMPLE_PY)
    assert "class Solution" in result["solution_code"]
    assert "maxSubArray" in result["solution_code"]


def test_parse_py_file_handles_no_docstring():
    result = parse_py_file(SAMPLE_PY_NO_DOCSTRING)
    assert result["description"] == ""
    assert result["examples"] == []
    assert "class Solution" in result["solution_code"]


def test_make_slug_basic():
    assert make_slug("Maximum Subarray") == "maximum-subarray"


def test_make_slug_with_numbers():
    assert make_slug("Two Sum") == "two-sum"


def test_make_slug_with_special_chars():
    assert make_slug("N-Queens II") == "n-queens-ii"
    assert make_slug("3Sum Closest") == "3sum-closest"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_scraper.py -v
```
Expected: ERROR — `ModuleNotFoundError: No module named 'seeds.scraper'`

- [ ] **Step 3: Create `backend/seeds/scraper.py` with parser functions**

```python
"""Scraper for importing problems from GitHub repository."""

import base64
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = "Garvit244/Leetcode"
DIRS = [
    "1-100q", "100-200q", "200-300q", "300-400q", "400-500Q",
    "600-700q", "800-900q", "900-1000q", "1000-1100q", "1100-1200q", "1200-1300q",
]
OUTPUT = Path("seeds/data/raw_problems.json")


def make_slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def parse_readme(readme: str) -> dict[int, dict]:
    """Parse README markdown tables → {external_id: metadata}."""
    problems: dict[int, dict] = {}
    # Matches: |53|[Title](url)|[Python](./dir/file.py)|Difficulty|
    pattern = re.compile(
        r"\|(\d+)\|\[([^\]]+)\]\(([^)]+)\)\|\[Python\]\(\./([^)]+)\)\|(\w+)\|"
    )
    for m in pattern.finditer(readme):
        ext_id = int(m.group(1))
        problems[ext_id] = {
            "external_id": ext_id,
            "title": m.group(2).strip(),
            "source_url": m.group(3).strip(),
            "file_path": m.group(4).strip(),
            "difficulty": m.group(5).lower().strip(),
        }
    return problems


def parse_py_file(content: str) -> dict:
    """Parse description, examples, constraints, solution from a .py file."""
    doc_match = re.match(r"^\s*(?:'''|\"\"\")(.*?)(?:'''|\"\"\")", content, re.DOTALL)

    description = ""
    examples: list[dict] = []
    constraints: str | None = None

    if doc_match:
        raw = doc_match.group(1).strip().replace("\t", " ")

        # Split description from examples
        parts = re.split(r"\n\s*Examples?\s*\d*\s*:", raw, maxsplit=1, flags=re.IGNORECASE)
        description = parts[0].strip()

        if len(parts) > 1:
            ex_section = parts[1]
            # Handle multiple examples (Example 1:, Example 2:, etc.)
            blocks = re.split(r"\n\s*Example\s*\d+\s*:", ex_section, flags=re.IGNORECASE)
            if not blocks[0].strip():
                blocks = blocks[1:]
            if not blocks:
                blocks = [ex_section]

            for block in blocks:
                inp = re.search(r"Input:\s*(.+?)(?:\n|$)", block)
                out = re.search(r"Output:\s*(.+?)(?:\n|$)", block)
                exp = re.search(r"Explanation:\s*(.+?)(?=\n\s*(?:Note|Input|Output|$))", block, re.DOTALL)
                if inp or out:
                    examples.append({
                        "input": inp.group(1).strip() if inp else "",
                        "output": out.group(1).strip() if out else "",
                        "explanation": exp.group(1).strip() if exp else "",
                    })

        # Constraints / Note section
        note = re.search(r"\n\s*Note:\s*(.+?)(?:\n\n|$)", raw, re.DOTALL | re.IGNORECASE)
        if note:
            constraints = note.group(1).strip()

    # Everything after the docstring = solution code
    solution_code = content[doc_match.end():].strip() if doc_match else content.strip()

    time_match = re.search(r"#\s*Time:\s*(.+)", solution_code)
    space_match = re.search(r"#\s*Space:\s*(.+)", solution_code)

    return {
        "description": description,
        "examples": examples,
        "constraints": constraints,
        "solution_code": solution_code,
        "time_complexity": time_match.group(1).strip() if time_match else None,
        "space_complexity": space_match.group(1).strip() if space_match else None,
    }


def _gh_api(path: str) -> dict | list:
    result = subprocess.run(
        ["gh", "api", f"repos/{REPO}/{path}"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def _fetch_readme() -> str:
    data = _gh_api("contents/README.md")
    return base64.b64decode(data["content"]).decode()


def _fetch_file(file_path: str) -> str:
    data = _gh_api(f"contents/{file_path}")
    return base64.b64decode(data["content"]).decode()


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    print("Fetching README...")
    readme = _fetch_readme()
    meta = parse_readme(readme)
    print(f"Found {len(meta)} problems in README")

    problems = []
    for i, (ext_id, m) in enumerate(sorted(meta.items())):
        print(f"[{i + 1}/{len(meta)}] #{ext_id}: {m['title']}", flush=True)
        try:
            content = _fetch_file(m["file_path"])
            parsed = parse_py_file(content)
            problems.append({
                "external_id": ext_id,
                "title": m["title"],
                "slug": make_slug(m["title"]),
                "source_url": m["source_url"],
                "difficulty": m["difficulty"],
                "language": "python",
                "source": "imported",
                "topic": [],
                **parsed,
            })
        except Exception as e:
            print(f"  WARNING: skipping {m['file_path']}: {e}", file=sys.stderr)

    OUTPUT.write_text(json.dumps(problems, indent=2))
    print(f"\nWrote {len(problems)} problems to {OUTPUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && uv run pytest tests/test_scraper.py -v
```
Expected: All PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/seeds/scraper.py backend/tests/test_scraper.py
git commit -m "feat(seeds): add scraper with README and .py file parsers"
```

---

## Task 6: Execute Scraper → raw_problems.json

**Files:**
- Generates: `backend/seeds/data/raw_problems.json` (gitignored)

- [ ] **Step 1: Verify gh CLI is authenticated**

```bash
gh auth status
```
Expected: `Logged in to github.com as <user>`

- [ ] **Step 2: Run the scraper from the backend directory**

```bash
cd backend && uv run python -m seeds.scraper
```
Expected output (abridged):
```
Fetching README...
Found 302 problems in README
[1/302] #4: Median of Two Sorted Arrays
[2/302] #5: Longest Palindromic Substring
...
Wrote 298 problems to seeds/data/raw_problems.json
```
(Some problems may be skipped if files have unexpected format — warnings are printed to stderr.)

- [ ] **Step 3: Verify the output**

```bash
cd backend && python -c "
import json
from pathlib import Path
data = json.loads(Path('seeds/data/raw_problems.json').read_text())
print(f'Total problems: {len(data)}')
print(f'Sample: {data[0][\"title\"]} | {data[0][\"difficulty\"]} | examples: {len(data[0][\"examples\"])}')
print(f'With solution code: {sum(1 for p in data if p[\"solution_code\"])}')
print(f'With time complexity: {sum(1 for p in data if p[\"time_complexity\"])}')
"
```
Expected:
```
Total problems: 290+ 
Sample: Median of Two Sorted Arrays | hard | examples: 2
With solution code: 290+
With time complexity: 50+
```

---

## Task 7: Write LLM Enricher (with Tests)

**Files:**
- Create: `backend/seeds/enrich.py`

- [ ] **Step 1: Write failing test for classify_batch function**

Add to `backend/tests/test_scraper.py`:
```python
def test_classify_batch_returns_list_of_lists():
    from unittest.mock import MagicMock, patch

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": '["array","hash-map"]'}}]
    }

    descriptions = ["Given an array of integers, return indices of the two numbers..."]

    with patch("seeds.enrich.httpx") as mock_httpx:
        mock_httpx.post.return_value = mock_response
        from seeds.enrich import classify_batch
        result = classify_batch(descriptions)

    assert isinstance(result, list)
    assert all(isinstance(tags, list) for tags in result)


def test_classify_batch_parses_nested_json():
    from unittest.mock import MagicMock, patch

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": '[["array","hash-map"],["dynamic-programming"]]'}}]
    }

    with patch("seeds.enrich.httpx") as mock_httpx:
        mock_httpx.post.return_value = mock_response
        from seeds.enrich import classify_batch
        result = classify_batch(["desc1", "desc2"])

    assert result == [["array", "hash-map"], ["dynamic-programming"]]
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_scraper.py::test_classify_batch_returns_list_of_lists tests/test_scraper.py::test_classify_batch_parses_nested_json -v
```
Expected: ERROR — `ModuleNotFoundError: No module named 'seeds.enrich'`

- [ ] **Step 3: Create `backend/seeds/enrich.py`**

```python
"""LLM topic classification for scraped problems."""

import json
import os
import re
from pathlib import Path

import httpx

RAW = Path("seeds/data/raw_problems.json")
OUTPUT = Path("seeds/data/enriched_problems.json")
BATCH_SIZE = 25
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-haiku-4-5"
VOCABULARY = [
    "array", "string", "hash-map", "two-pointers", "sliding-window",
    "binary-search", "linked-list", "stack", "queue", "tree", "graph",
    "dynamic-programming", "greedy", "backtracking", "math",
    "bit-manipulation", "heap", "sorting",
]


def classify_batch(descriptions: list[str]) -> list[list[str]]:
    """Classify a batch of problem descriptions into topic tags."""
    vocab_str = ", ".join(VOCABULARY)
    numbered = "\n".join(f"{i + 1}. {d[:400]}" for i, d in enumerate(descriptions))
    prompt = (
        f"Classify each problem into 1-4 topics from this vocabulary: {vocab_str}\n\n"
        f"If there is only one problem, respond with a single JSON array like: [\"array\",\"hash-map\"]\n"
        f"If there are multiple problems, respond with a JSON array of arrays like: "
        f"[[\"array\"],[\"dynamic-programming\",\"tree\"]]\n"
        f"Respond with ONLY the JSON. No explanation.\n\n"
        f"Problems:\n{numbered}"
    )

    response = httpx.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
        },
        timeout=60.0,
    )
    response.raise_for_status()
    raw = response.json()["choices"][0]["message"]["content"].strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    parsed = json.loads(raw)

    # Normalise: single problem returns flat list, multiple returns nested
    if descriptions and not isinstance(parsed[0], list):
        return [parsed]
    return parsed


def main() -> None:
    problems = json.loads(RAW.read_text())
    print(f"Classifying topics for {len(problems)} problems...")

    descriptions = [p.get("description") or p["title"] for p in problems]
    all_topics: list[list[str]] = []

    for i in range(0, len(descriptions), BATCH_SIZE):
        batch = descriptions[i : i + BATCH_SIZE]
        end = min(i + BATCH_SIZE, len(descriptions))
        print(f"  Batch {i + 1}–{end} ({len(batch)} problems)...", flush=True)
        try:
            topics = classify_batch(batch)
            all_topics.extend(topics)
        except Exception as e:
            print(f"  WARNING: batch failed, using empty tags: {e}")
            all_topics.extend([[] for _ in batch])

    for problem, topics in zip(problems, all_topics):
        problem["topic"] = topics

    OUTPUT.write_text(json.dumps(problems, indent=2))
    print(f"Wrote enriched data to {OUTPUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && uv run pytest tests/test_scraper.py::test_classify_batch_returns_list_of_lists tests/test_scraper.py::test_classify_batch_parses_nested_json -v
```
Expected: PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/seeds/enrich.py backend/tests/test_scraper.py
git commit -m "feat(seeds): add LLM topic enricher with batch classification"
```

---

## Task 8: Execute Enricher → enriched_problems.json

**Files:**
- Reads: `backend/seeds/data/raw_problems.json`
- Generates: `backend/seeds/data/enriched_problems.json` (gitignored)

- [ ] **Step 1: Confirm OPENROUTER_API_KEY is set**

```bash
cd backend && grep OPENROUTER_API_KEY .env
```
Expected: `OPENROUTER_API_KEY=sk-or-...` (must not be the placeholder)

- [ ] **Step 2: Run the enricher**

```bash
cd backend && uv run python -m seeds.enrich
```
Expected (takes 3–5 min for 300 problems in batches of 25):
```
Classifying topics for 298 problems...
  Batch 1–25 (25 problems)...
  Batch 26–50 (25 problems)...
  ...
Wrote enriched data to seeds/data/enriched_problems.json
```

- [ ] **Step 3: Verify topics were assigned**

```bash
cd backend && python -c "
import json
from pathlib import Path
data = json.loads(Path('seeds/data/enriched_problems.json').read_text())
with_topics = [p for p in data if p['topic']]
print(f'Problems with topics: {len(with_topics)}/{len(data)}')
for p in data[:5]:
    print(f'  #{p[\"external_id\"]} {p[\"title\"]}: {p[\"topic\"]}')
"
```
Expected:
```
Problems with topics: 290+/298
  #4 Median of Two Sorted Arrays: ['binary-search', 'array']
  #5 Longest Palindromic Substring: ['string', 'dynamic-programming']
  ...
```

---

## Task 9: Write Seed Script (with Tests)

**Files:**
- Create: `backend/seeds/problems_dataset.py`
- Modify: `backend/tests/test_problems.py`

- [ ] **Step 1: Write failing test for seed script**

Add to `backend/tests/test_problems.py`:
```python
def test_seed_problems_dataset_inserts_records(db):
    from seeds.problems_dataset import _insert_problem_with_solution

    item = {
        "external_id": 99999,
        "title": "Test Problem",
        "slug": "test-problem",
        "description": "Given a number, return it.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["math"],
        "examples": [{"input": "1", "output": "1", "explanation": ""}],
        "constraints": None,
        "hints": None,
        "source_url": "https://example.com/99999",
        "source": "imported",
        "solution_code": "class Solution:\n    def solve(self, n): return n",
        "time_complexity": "O(1)",
        "space_complexity": "O(1)",
    }

    _insert_problem_with_solution(db, item)
    db.commit()

    from models.learning import Problem, ProblemSolution
    problem = db.query(Problem).filter(Problem.external_id == 99999).first()
    assert problem is not None
    assert problem.title == "Test Problem"
    assert problem.topic == ["math"]

    solution = db.query(ProblemSolution).filter(ProblemSolution.problem_id == problem.id).first()
    assert solution is not None
    assert solution.variant == "original"
    assert solution.is_primary is True
    assert solution.time_complexity == "O(1)"


def test_seed_skips_duplicates(db):
    from seeds.problems_dataset import _insert_problem_with_solution

    item = {
        "external_id": 88888,
        "title": "Duplicate Problem",
        "slug": "duplicate-problem",
        "description": "Test description.",
        "difficulty": "easy",
        "language": "python",
        "topic": [],
        "examples": [],
        "constraints": None,
        "hints": None,
        "source_url": None,
        "source": "imported",
        "solution_code": "pass",
        "time_complexity": None,
        "space_complexity": None,
    }

    _insert_problem_with_solution(db, item)
    db.commit()

    inserted = _insert_problem_with_solution(db, item)
    assert inserted is False
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_problems.py::test_seed_problems_dataset_inserts_records tests/test_problems.py::test_seed_skips_duplicates -v
```
Expected: ERROR — `ModuleNotFoundError: No module named 'seeds.problems_dataset'`

- [ ] **Step 3: Create `backend/seeds/problems_dataset.py`**

```python
"""Seed script: insert enriched problems and their original solutions into the DB."""

import json
from pathlib import Path

from db.session import SessionLocal
from models.learning import Problem, ProblemSolution
from sqlalchemy.orm import Session

ENRICHED = Path("seeds/data/enriched_problems.json")


def _insert_problem_with_solution(db: Session, item: dict) -> bool:
    """Insert one problem + original solution. Returns False if already exists."""
    existing = (
        db.query(Problem)
        .filter(Problem.external_id == item["external_id"], Problem.language == item["language"])
        .first()
    )
    if existing:
        return False

    problem = Problem(
        title=item["title"],
        slug=item.get("slug"),
        description=item.get("description") or item["title"],
        difficulty=item["difficulty"],
        language=item["language"],
        topic=item.get("topic") or [],
        examples=item.get("examples") or [],
        constraints=item.get("constraints"),
        hints=item.get("hints"),
        external_id=item.get("external_id"),
        source_url=item.get("source_url"),
        source=item.get("source", "imported"),
        is_published=True,
    )
    db.add(problem)
    db.flush()

    if item.get("solution_code"):
        solution = ProblemSolution(
            problem_id=problem.id,
            language=item["language"],
            variant="original",
            code=item["solution_code"],
            time_complexity=item.get("time_complexity"),
            space_complexity=item.get("space_complexity"),
            explanation=None,
            is_primary=True,
        )
        db.add(solution)

    return True


def seed_problems_dataset() -> None:
    if not ENRICHED.exists():
        print(f"ERROR: {ENRICHED} not found. Run 'python -m seeds.scraper' then 'python -m seeds.enrich' first.")
        return

    data = json.loads(ENRICHED.read_text())
    db = SessionLocal()
    try:
        inserted = skipped = 0
        for item in data:
            result = _insert_problem_with_solution(db, item)
            if result:
                inserted += 1
            else:
                skipped += 1
        db.commit()
        print(f"Done: {inserted} inserted, {skipped} skipped.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_problems_dataset()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && uv run pytest tests/test_problems.py::test_seed_problems_dataset_inserts_records tests/test_problems.py::test_seed_skips_duplicates -v
```
Expected: PASSED

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd backend && uv run pytest -v
```
Expected: All existing tests still PASS

- [ ] **Step 6: Commit**

```bash
git add backend/seeds/problems_dataset.py backend/tests/test_problems.py
git commit -m "feat(seeds): add problems_dataset seed script with duplicate-skip logic"
```

---

## Task 10: Execute Seed Script + Verify DB

- [ ] **Step 1: Run the seed script**

```bash
cd backend && uv run python -m seeds.problems_dataset
```
Expected:
```
Done: 295 inserted, 0 skipped.
```

- [ ] **Step 2: Verify counts in DB**

```bash
cd backend && uv run python -c "
from db.session import SessionLocal
from models.learning import Problem, ProblemSolution

db = SessionLocal()
total = db.query(Problem).filter(Problem.source == 'imported').count()
with_solutions = db.query(ProblemSolution).filter(ProblemSolution.variant == 'original').count()
easy = db.query(Problem).filter(Problem.difficulty == 'easy', Problem.source == 'imported').count()
medium = db.query(Problem).filter(Problem.difficulty == 'medium', Problem.source == 'imported').count()
hard = db.query(Problem).filter(Problem.difficulty == 'hard', Problem.source == 'imported').count()
print(f'Total imported problems: {total}')
print(f'With original solutions: {with_solutions}')
print(f'Easy: {easy} | Medium: {medium} | Hard: {hard}')
db.close()
"
```
Expected:
```
Total imported problems: 290+
With original solutions: 290+
Easy: 80+ | Medium: 150+ | Hard: 50+
```

---

## Task 11: Add Lazy Solution Variant Endpoint (with Tests)

**Files:**
- Modify: `backend/api/problems.py`
- Modify: `backend/tests/test_problems.py`

- [ ] **Step 1: Write failing tests for the new endpoint**

Add to `backend/tests/test_problems.py`:
```python
def test_generate_solution_cached(client, auth_headers, db):
    from models.learning import Problem, ProblemSolution

    problem = Problem(
        title="Cache Test", description="Test.", difficulty="easy",
        language="python", source="curated", is_published=True,
    )
    db.add(problem)
    db.flush()
    solution = ProblemSolution(
        problem_id=problem.id, language="python", variant="optimal",
        code="def solve(): return 42", is_primary=False,
    )
    db.add(solution)
    db.commit()

    resp = client.post(
        f"/problems/{problem.id}/solutions/generate?variant=optimal",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["variant"] == "optimal"
    assert data["code"] == "def solve(): return 42"


def test_generate_solution_invalid_variant(client, auth_headers, db):
    from models.learning import Problem

    problem = Problem(
        title="Variant Test", description="Test.", difficulty="easy",
        language="python", source="curated", is_published=True,
    )
    db.add(problem)
    db.commit()

    resp = client.post(
        f"/problems/{problem.id}/solutions/generate?variant=invalid",
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_generate_solution_problem_not_found(client, auth_headers):
    import uuid
    resp = client.post(
        f"/problems/{uuid.uuid4()}/solutions/generate?variant=optimal",
        headers=auth_headers,
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_problems.py::test_generate_solution_cached tests/test_problems.py::test_generate_solution_invalid_variant tests/test_problems.py::test_generate_solution_problem_not_found -v
```
Expected: FAILED — 404 (endpoint doesn't exist yet)

- [ ] **Step 3: Add imports and endpoint to `backend/api/problems.py`**

Replace the import block at the top of `backend/api/problems.py` with:
```python
import json
import os
import re
import uuid
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.deps import get_current_user
from db.session import get_db
from models.learning import Problem, ProblemSolution
from models.users import User
from schemas.problem import ProblemListOut, ProblemOut, ProblemSolutionOut
```

Add after the existing `get_problem` endpoint:
```python
_VARIANT_PROMPT = {
    "optimal": (
        "Rewrite the following Python solution to be as time and space efficient as possible. "
        "Return ONLY a JSON object with keys: code (str), time_complexity (str), "
        "space_complexity (str), explanation (str, one paragraph).\n\nOriginal code:\n{code}"
    ),
    "clean": (
        "Rewrite the following Python solution to be maximally readable and idiomatic. "
        "Prioritise clarity over micro-optimisations. "
        "Return ONLY a JSON object with keys: code (str), time_complexity (str), "
        "space_complexity (str), explanation (str, one paragraph).\n\nOriginal code:\n{code}"
    ),
    "brute_force": (
        "Write a simple brute-force Python solution for the following problem description. "
        "Correctness over efficiency. "
        "Return ONLY a JSON object with keys: code (str), time_complexity (str), "
        "space_complexity (str), explanation (str, one paragraph).\n\nProblem:\n{code}"
    ),
}


@router.post("/{problem_id}/solutions/generate", response_model=ProblemSolutionOut)
async def generate_solution_variant(
    problem_id: uuid.UUID,
    variant: Literal["optimal", "clean", "brute_force"],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProblemSolutionOut:
    del current_user

    problem = db.query(Problem).filter(Problem.id == problem_id, Problem.is_published.is_(True)).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Problem {problem_id} not found")

    cached = (
        db.query(ProblemSolution)
        .filter(ProblemSolution.problem_id == problem_id, ProblemSolution.variant == variant)
        .first()
    )
    if cached:
        return cached

    original = (
        db.query(ProblemSolution)
        .filter(ProblemSolution.problem_id == problem_id, ProblemSolution.variant == "original")
        .first()
    )
    source_text = original.code if original else problem.description

    prompt = _VARIANT_PROMPT[variant].format(code=source_text)
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "anthropic/claude-haiku-4-5",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 2048,
            },
        )
        resp.raise_for_status()

    raw = resp.json()["choices"][0]["message"]["content"]
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    llm_data: dict = json.loads(raw)

    solution = ProblemSolution(
        problem_id=problem_id,
        language="python",
        variant=variant,
        code=llm_data.get("code", ""),
        time_complexity=llm_data.get("time_complexity"),
        space_complexity=llm_data.get("space_complexity"),
        explanation=llm_data.get("explanation"),
        is_primary=False,
    )
    db.add(solution)
    db.commit()
    db.refresh(solution)
    return solution
```

Also add `import json` to the imports if not already present.

- [ ] **Step 4: Run endpoint tests**

```bash
cd backend && uv run pytest tests/test_problems.py::test_generate_solution_cached tests/test_problems.py::test_generate_solution_invalid_variant tests/test_problems.py::test_generate_solution_problem_not_found -v
```
Expected: PASSED

- [ ] **Step 5: Run full test suite**

```bash
cd backend && uv run pytest -v
```
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/api/problems.py backend/tests/test_problems.py
git commit -m "feat(api): add POST /problems/{id}/solutions/generate with cache-first lazy LLM generation"
```

---

## Task 12: Push and Open PR

- [ ] **Step 1: Run full test suite one final time**

```bash
cd backend && uv run pytest -v
```
Expected: All tests PASS

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/problem-dataset
```

- [ ] **Step 3: Open PR**

```bash
gh pr create \
  --title "feat(dataset): seed 300+ algorithm problems with topics, solutions, and lazy variant generation" \
  --body "## Summary
- Add \`ProblemSolution\` table (multiple solution variants per problem)
- Extend \`Problem\` model with \`slug\`, \`external_id\`, \`source_url\`, \`hints\`
- Alembic migration for all schema changes
- Scraper parses GitHub repo → \`raw_problems.json\` (300+ problems)
- LLM enricher classifies topics in batches of 25 via OpenRouter
- Seed script inserts problems + original solutions; skips duplicates
- \`POST /problems/{id}/solutions/generate?variant=optimal|clean|brute_force\` — generates and caches variants lazily

## Test plan
- [ ] \`cd backend && uv run pytest -v\` — all tests pass
- [ ] \`python -m seeds.scraper\` → \`raw_problems.json\` created with 290+ entries
- [ ] \`python -m seeds.enrich\` → topics assigned to all problems
- [ ] \`python -m seeds.problems_dataset\` → DB shows 290+ imported problems
- [ ] \`GET /problems?difficulty=easy\` returns paginated easy problems with topic tags
- [ ] \`POST /problems/{id}/solutions/generate?variant=optimal\` returns cached result on second call"
```
