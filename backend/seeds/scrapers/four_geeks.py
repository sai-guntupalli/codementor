"""Scrape 4GeeksAcademy Python exercise repos."""

import re
import subprocess
from pathlib import Path

from core.problem_content import pre_clean_description
from core.problem_titles import strip_curriculum_prefix

CLONE_ROOT = Path("/tmp/hmc_scrape/4geeks")

REPOS = [
    {
        "name": "beginner",
        "url": "https://github.com/4GeeksAcademy/python-beginner-programming-exercises.git",
        "sort_base": 100,
    },
    {
        "name": "lists-loops",
        "url": "https://github.com/4GeeksAcademy/python-lists-loops-programming-exercises.git",
        "sort_base": 150,
    },
    {
        "name": "functions",
        "url": "https://github.com/4GeeksAcademy/python-functions-programming-exercises.git",
        "sort_base": 200,
    },
    {
        "name": "master",
        "url": "https://github.com/4GeeksAcademy/master-python-programming-exercises.git",
        "sort_base": 230,
    },
]

_IMG_RE = re.compile(r"!\[.*?\]\(.*?\)")
_FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
_HEADING_RE = re.compile(r"^#+\s+", re.MULTILINE)


def _ensure_clone(repo: dict) -> Path:
    dest = CLONE_ROOT / repo["name"]
    if dest.exists():
        subprocess.run(["git", "-C", str(dest), "pull", "--ff-only", "-q"], check=False)
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth=1", repo["url"], str(dest)],
            check=True,
        )
    return dest


def _clean_readme(text: str) -> str:
    text = _FRONTMATTER_RE.sub("", text)
    text = _IMG_RE.sub("", text)
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Collapse blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_title(text: str) -> str | None:
    m = re.search(r"^#+\s+(.+)", text, re.MULTILINE)
    return m.group(1).strip() if m else None


def _topic_from_repo(repo_name: str) -> list[str]:
    mapping = {
        "beginner": ["basics", "io"],
        "lists-loops": ["lists", "loops"],
        "functions": ["functions"],
        "master": ["python"],
    }
    return mapping.get(repo_name, ["python"])


def _scrape_repo(repo: dict) -> list[dict]:
    dest = _ensure_clone(repo)
    exercises_dir = dest / "exercises"
    if not exercises_dir.exists():
        # Some repos have exercises directly in root named 00-*, 01-*, etc.
        exercises_dir = dest

    problems: list[dict] = []
    counter = 0

    # Collect exercise dirs: named like 00-hello-world, 01-print-name, etc.
    ex_dirs = sorted(
        [d for d in exercises_dir.iterdir() if d.is_dir() and re.match(r"^\d+", d.name)]
    )

    for ex_dir in ex_dirs:
        readme = ex_dir / "README.md"
        solution = ex_dir / "solution.hide.py"

        if not readme.exists():
            continue

        raw_readme = readme.read_text(errors="ignore")
        description = _clean_readme(raw_readme)
        description, readme_hints = pre_clean_description(description)
        if len(description) < 20:
            continue

        raw_title = _extract_title(raw_readme) or ex_dir.name.replace("-", " ").title()
        title = strip_curriculum_prefix(raw_title)
        # Remove leading number prefix from dir name for slug
        slug_base = re.sub(r"^\d+-?", "", ex_dir.name)
        slug = f"4geeks-{slug_base}" if slug_base else f"4geeks-{ex_dir.name}"

        examples: list[dict] = []

        counter += 1
        problems.append(
            {
                "title": title,
                "slug": slug,
                "description": description,
                "difficulty": "easy",
                "language": "python",
                "topic": _topic_from_repo(repo["name"]),
                "examples": examples,
                "hints": readme_hints or None,
                "constraints": None,
                "source": "imported",
                "source_url": repo["url"].replace(".git", ""),
                "is_published": True,
                "sort_order": repo["sort_base"] + counter,
            }
        )

    return problems


def scrape() -> list[dict]:
    problems: list[dict] = []
    for repo in REPOS:
        try:
            problems.extend(_scrape_repo(repo))
        except subprocess.CalledProcessError as exc:
            print(f"  WARNING: could not clone {repo['name']}: {exc}")
    return problems
