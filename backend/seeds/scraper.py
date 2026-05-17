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
    """Parse README markdown tables -> {external_id: metadata}."""
    problems: dict[int, dict] = {}
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
                inp = re.search(r"Input:\s*(.+?)(?:\n|$)", block)
                out = re.search(r"Output:\s*(.+?)(?:\n|$)", block)
                exp = re.search(r"Explanation:\s*(.+?)(?=\n\s*(?:Note|Input|Output|$))", block, re.DOTALL)
                if inp or out:
                    examples.append({
                        "input": inp.group(1).strip() if inp else "",
                        "output": out.group(1).strip() if out else "",
                        "explanation": exp.group(1).strip() if exp else "",
                    })

        note = re.search(r"\n\s*Note:\s*(.+?)(?:\n\n|$)", raw, re.DOTALL | re.IGNORECASE)
        if note:
            constraints = note.group(1).strip()

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
