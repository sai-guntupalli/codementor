"""Scrape exercism/python: parse config.json + exercise files from a local clone."""

import json
import re
import subprocess
from pathlib import Path

CLONE_DIR = Path("/tmp/hmc_scrape/exercism-python")
REPO_URL = "https://github.com/exercism/python.git"

# Sort order base: difficulty 1-2 → 300+, difficulty 3-5 → 500+
_SORT_BASE = {1: 300, 2: 350, 3: 500, 4: 600, 5: 700}


def _ensure_clone() -> None:
    if CLONE_DIR.exists():
        subprocess.run(["git", "-C", str(CLONE_DIR), "pull", "--ff-only", "-q"], check=False)
    else:
        CLONE_DIR.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth=1", REPO_URL, str(CLONE_DIR)],
            check=True,
        )


def _clean_description(text: str) -> str:
    # Remove top-level "# Instructions" header
    text = re.sub(r"^#+\s*Instructions\s*\n", "", text, flags=re.IGNORECASE | re.MULTILINE)
    # Remove exercism-specific image badges / links
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    # Remove exercism-specific "Source" sections at the end
    text = re.sub(r"\n+## Source.*$", "", text, flags=re.DOTALL)
    return text.strip()


def _parse_parametrize(test_file: Path) -> list[dict]:
    """Extract up to 3 input/output pairs from @pytest.mark.parametrize."""
    if not test_file.exists():
        return []
    src = test_file.read_text(errors="ignore")
    # Find parametrize decorators and capture their content
    examples = []
    for match in re.finditer(
        r"@pytest\.mark\.parametrize\([^)]*\(([^)]*)\)", src, re.DOTALL
    ):
        # Try to extract tuples from the parametrize block
        tuples = re.findall(r"\(([^()]+)\)", match.group(1))
        for t in tuples[:3]:
            parts = [p.strip().strip('"\'') for p in t.split(",")]
            if len(parts) >= 2:
                examples.append({"input": parts[0], "output": parts[-1]})
            if len(examples) >= 3:
                break
        if examples:
            break
    return examples[:3]


def scrape() -> list[dict]:
    _ensure_clone()

    config_path = CLONE_DIR / "config.json"
    if not config_path.exists():
        return []

    config = json.loads(config_path.read_text())
    exercises = config.get("exercises", {}).get("practice", [])

    problems: list[dict] = []
    counter: dict[int, int] = {}

    for ex in exercises:
        difficulty: int = ex.get("difficulty", 5)
        if difficulty > 5:
            continue

        slug: str = ex.get("slug", "")
        if not slug:
            continue

        ex_dir = CLONE_DIR / "exercises" / "practice" / slug
        instructions_file = ex_dir / ".docs" / "instructions.md"
        if not instructions_file.exists():
            continue

        description = _clean_description(instructions_file.read_text(errors="ignore"))
        if len(description) < 20:
            continue

        # Find test file for examples
        test_files = list(ex_dir.glob("*_test.py"))
        examples = _parse_parametrize(test_files[0]) if test_files else []
        if not examples:
            examples = [{"input": "(see description)", "output": "(see description)"}]

        topics: list[str] = ex.get("practices", []) or ex.get("prerequisites", [])
        if not topics:
            topics = ["python"]
        topics = topics[:5]  # cap to 5

        # Assign sort_order within difficulty band
        base = _SORT_BASE.get(difficulty, 700)
        counter[base] = counter.get(base, 0) + 1
        sort_order = base + counter[base]

        difficulty_label = "easy" if difficulty <= 2 else "medium"

        problems.append(
            {
                "title": ex.get("name", slug.replace("-", " ").title()),
                "slug": f"exercism-{slug}",
                "description": description,
                "difficulty": difficulty_label,
                "language": "python",
                "topic": topics,
                "examples": examples,
                "constraints": None,
                "source": "imported",
                "source_url": f"https://exercism.org/tracks/python/exercises/{slug}",
                "is_published": True,
                "sort_order": sort_order,
            }
        )

    return problems
