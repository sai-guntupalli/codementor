"""Scrape Python LeetCode problems from github.com/Garvit244/Leetcode."""

from __future__ import annotations

import re
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import httpx

REPO = "Garvit244/Leetcode"
BRANCH = "master"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}"
SOURCE_BASE = f"https://github.com/{REPO}/tree/{BRANCH}"

# LeetCode table rows: |id|[title](url)|[Python](./path)|Difficulty|
# Allow optional spaces around pipes (README formatting varies by section).
README_ROW = re.compile(
    r"\|(\d+)\|\[([^\]]+)\]\(([^)]+)\)\|\s*\[Python\]\(\./([^)]+)\)\s*\|(\w+)\s*\|?",
    re.IGNORECASE,
)

DOCSTRING_RE = re.compile(r"^\s*(?:'''|\"\"\")(.*?)(?:'''|\"\"\")", re.DOTALL)


def make_slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def normalize_difficulty(raw: str) -> str:
    d = raw.strip().lower()
    if d in ("easy", "medium", "hard"):
        return d
    return "medium"


def parse_readme(readme: str) -> dict[int, dict[str, Any]]:
    """Parse README markdown tables → {external_id: metadata}."""
    problems: dict[int, dict[str, Any]] = {}
    for m in README_ROW.finditer(readme):
        ext_id = int(m.group(1))
        problems[ext_id] = {
            "external_id": ext_id,
            "title": m.group(2).strip(),
            "source_url": m.group(3).strip(),
            "file_path": m.group(4).strip(),
            "difficulty": normalize_difficulty(m.group(5)),
        }
    return problems


def parse_py_file(content: str) -> dict[str, Any]:
    """Parse description, examples, constraints, and solution from a .py file."""
    doc_match = DOCSTRING_RE.match(content)

    description = ""
    examples: list[dict[str, str]] = []
    constraints: str | None = None

    if doc_match:
        raw = doc_match.group(1).strip().replace("\t", " ")

        parts = re.split(r"\n\s*Examples?\s*\d*\s*:", raw, maxsplit=1, flags=re.IGNORECASE)
        description = parts[0].strip()

        if len(parts) > 1:
            ex_section = parts[1]
            blocks = re.split(r"\n\s*Example\s*\d+\s*:", ex_section, flags=re.IGNORECASE)
            if not blocks[0].strip():
                blocks = blocks[1:]
            if not blocks:
                blocks = [ex_section]

            for block in blocks:
                inp = re.search(r"Input:\s*(.+?)(?:\n|$)", block, re.IGNORECASE)
                out = re.search(r"Output:\s*(.+?)(?:\n|$)", block, re.IGNORECASE)
                exp = re.search(
                    r"Explanation:\s*(.+?)(?=\n\s*(?:Note|Input|Output|$))",
                    block,
                    re.DOTALL | re.IGNORECASE,
                )
                if inp or out:
                    examples.append(
                        {
                            "input": inp.group(1).strip() if inp else "",
                            "output": out.group(1).strip() if out else "",
                            "explanation": exp.group(1).strip() if exp else "",
                        }
                    )

        note = re.search(r"\n\s*Note:\s*(.+?)(?:\n\n|$)", raw, re.DOTALL | re.IGNORECASE)
        if note:
            constraints = note.group(1).strip()

    solution_code = content[doc_match.end() :].strip() if doc_match else content.strip()
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


def ensure_examples(examples: list[dict[str, str]], description: str) -> list[dict[str, str]]:
    if examples:
        return examples
    snippet = (description or "").strip()[:200]
    return [
        {
            "input": "(see problem)",
            "output": "(see problem)",
            "explanation": snippet or "Refer to the problem description on LeetCode.",
        }
    ]


def build_problem_record(meta: dict[str, Any], parsed: dict[str, Any]) -> dict[str, Any]:
    description = (parsed.get("description") or "").strip() or meta["title"]
    return {
        "external_id": meta["external_id"],
        "title": meta["title"],
        "slug": make_slug(meta["title"]),
        "source_url": meta["source_url"],
        "difficulty": meta["difficulty"],
        "language": "python",
        "source": "imported",
        "topic": [],
        "description": description,
        "examples": ensure_examples(parsed.get("examples") or [], description),
        "constraints": parsed.get("constraints"),
        "solution_code": parsed.get("solution_code") or "",
        "time_complexity": parsed.get("time_complexity"),
        "space_complexity": parsed.get("space_complexity"),
        "sort_order": 10_000 + meta["external_id"],
        "is_published": True,
    }


def _fetch_one(client: httpx.Client, ext_id: int, meta: dict[str, Any]) -> dict[str, Any] | None:
    try:
        resp = client.get(f"{RAW_BASE}/{meta['file_path']}")
        resp.raise_for_status()
        parsed = parse_py_file(resp.text)
        if not (parsed.get("solution_code") or "").strip():
            return None
        return build_problem_record(meta, parsed)
    except Exception:
        return None


def scrape_all(
    *,
    workers: int = 12,
    client: httpx.Client | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> list[dict[str, Any]]:
    """Fetch README + all .py files from the repo."""
    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=60.0, follow_redirects=True)

    try:
        readme_resp = client.get(f"{RAW_BASE}/README.md")
        readme_resp.raise_for_status()
        meta = parse_readme(readme_resp.text)
        if on_progress:
            on_progress(f"README: {len(meta)} problems listed")

        sorted_ids = sorted(meta.keys())
        problems: list[dict[str, Any]] = []
        done = 0

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(_fetch_one, client, ext_id, meta[ext_id]): ext_id
                for ext_id in sorted_ids
            }
            for fut in as_completed(futures):
                ext_id = futures[fut]
                done += 1
                if on_progress and done % 25 == 0:
                    on_progress(f"Fetched {done}/{len(sorted_ids)}...")
                record = fut.result()
                if record:
                    problems.append(record)

        if on_progress:
            on_progress(f"Done: {len(problems)} problems with solutions")
        return problems
    finally:
        if own_client and client:
            client.close()
