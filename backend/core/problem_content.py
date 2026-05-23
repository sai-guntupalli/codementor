"""Detect and normalize problem copy for Help Me Code (LeetCode-style statements)."""

from __future__ import annotations

import re

from core.problem_titles import strip_curriculum_prefix

_PLACEHOLDER_RE = re.compile(
    r"see description|see solution|refer to the problem|\(see solution\)|\(see description\)",
    re.IGNORECASE,
)


def _is_na_placeholder(value: str) -> bool:
    return value.strip().lower() in {"n/a", "na", "none"}
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "\U00002600-\U000026FF"
    "]+",
    flags=re.UNICODE,
)
_CURRICULUM_HEADING_RE = re.compile(
    r"^#+\s*`?(?:\d{2,3}(?:\.\d+)?|\d{1,2}\.\d+)`?\s+",
    re.MULTILINE,
)
# Exercise/module ids in titles (not algorithm names like "4Sum").
_CURRICULUM_TITLE_RE = re.compile(
    r"^\`?(?:\d{2,3}(?:\.\d+)?|\d{1,2}\.\d+)`?\s+",
)
_INSTRUCTIONS_BLOCK_RE = re.compile(
    r"(?im)^#+\s*[^\n]*instructions[^\n]*\n.*?(?=^#+\s|\Z)",
    re.DOTALL,
)
_HINTS_BLOCK_RE = re.compile(
    r"(?im)^#+\s*[^\n]*hints?[^\n]*\n(.*)",
    re.DOTALL,
)
_HINT_BULLET_RE = re.compile(r"^[\s>*+-]+\s*(.+)$", re.MULTILINE)


def has_placeholder_examples(examples: list | None) -> bool:
    if not examples:
        return True
    for ex in examples:
        if not isinstance(ex, dict):
            return True
        inp = str(ex.get("input", "")).strip()
        out = str(ex.get("output", "")).strip()
        if not out:
            return True
        if _PLACEHOLDER_RE.search(inp) or _PLACEHOLDER_RE.search(out):
            return True
        if _is_na_placeholder(inp) or _is_na_placeholder(out):
            return True
    return False


def extract_hints_from_description(text: str) -> tuple[str, list[str]]:
    """Pull hint bullets out of markdown hint sections; return cleaned description."""
    hints: list[str] = []
    m = _HINTS_BLOCK_RE.search(text)
    if m:
        block = m.group(1)
        for line in block.splitlines():
            bullet = _HINT_BULLET_RE.match(line.strip())
            if bullet:
                hint = bullet.group(1).strip()
                if hint and len(hint) > 8:
                    hints.append(hint)
        text = text[: m.start()] + text[m.end() :]

    text = _INSTRUCTIONS_BLOCK_RE.sub("", text)
    return text.strip(), hints[:3]


def pre_clean_description(text: str) -> tuple[str, list[str]]:
    """Deterministic cleanup before LLM rewrite."""
    if not text:
        return "", []

    text, hints = extract_hints_from_description(text)
    text = _CURRICULUM_HEADING_RE.sub("", text)
    text = _EMOJI_RE.sub("", text)
    # Drop lines that are only labels like "Instructions:" / "Hints:"
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if re.match(r"(?i)^(instructions?|hints?)\s*:?\s*$", stripped):
            continue
        if re.match(r"(?i)^📝|^💡", stripped):
            continue
        lines.append(line)
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text, hints


def normalize_title(title: str) -> str:
    cleaned = strip_curriculum_prefix((title or "").strip())
    cleaned = _EMOJI_RE.sub("", cleaned).strip()
    return cleaned or (title or "").strip()


def validate_normalized(
    *,
    title: str,
    description: str,
    examples: list,
    constraints: str | None = None,
) -> list[str]:
    """Return human-readable validation errors; empty list means OK."""
    errors: list[str] = []
    if not normalize_title(title):
        errors.append("empty title")
    if normalize_title(title) != title.strip():
        errors.append("title has curriculum prefix or emoji")
    if _CURRICULUM_TITLE_RE.match(title.strip()):
        errors.append("title starts with exercise number")

    desc = (description or "").strip()
    if len(desc) < 20:
        errors.append("description too short")
    if _EMOJI_RE.search(desc):
        errors.append("description contains emoji")
    if re.search(r"(?i)(^|\n)#+\s*(instructions|hints)", desc):
        errors.append("description has Instructions/Hints heading")
    if re.search(r"(?i)\binstructions?\s*:", desc):
        errors.append("description has Instructions label")
    if re.search(r"(?i)\bhints?\s*:", desc):
        errors.append("description has Hints label")
    if _CURRICULUM_HEADING_RE.search(desc):
        errors.append("description has curriculum heading")

    valid_count = 0
    if examples:
        for ex in examples:
            if isinstance(ex, dict) and not _PLACEHOLDER_RE.search(
                str(ex.get("input", ""))
            ) and not _PLACEHOLDER_RE.search(str(ex.get("output", ""))):
                valid_count += 1
    if valid_count < 1:
        errors.append("examples missing or placeholder")

    if constraints and _EMOJI_RE.search(constraints):
        errors.append("constraints contain emoji")

    return errors


def needs_normalize(
    *,
    title: str,
    description: str,
    examples: list | None,
) -> bool:
    """True when problem copy should be rewritten for the app theme."""
    if normalize_title(title) != (title or "").strip():
        return True
    if _CURRICULUM_TITLE_RE.match((title or "").strip()):
        return True

    desc = description or ""
    if len(desc.strip()) < 25:
        return True
    if len(desc.strip()) < 50 and has_placeholder_examples(examples):
        return True
    if _EMOJI_RE.search(desc):
        return True
    if re.search(r"(?i)(^|\n)#+\s*(instructions|hints)", desc):
        return True
    if re.search(r"(?i)\binstructions?\s*:", desc):
        return True
    if re.search(r"(?i)\bhints?\s*:", desc):
        return True
    if _CURRICULUM_HEADING_RE.search(desc):
        return True
    if has_placeholder_examples(examples):
        return True
    return False
