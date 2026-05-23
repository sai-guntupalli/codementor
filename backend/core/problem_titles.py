"""Normalize imported exercise titles (e.g. 4Geeks `` `01.5` Add items ``)."""

from __future__ import annotations

import re

# Module/exercise ids: 01.5, 05, 026, 09.1 (optional markdown backticks).
_CURRICULUM_PREFIX = re.compile(
    r"^`?(?:\d{2,3}(?:\.\d+)?|\d{1,2}\.\d+)`?\s+",
)


def strip_curriculum_prefix(title: str) -> str:
    """Remove leading curriculum exercise numbers from a problem title."""
    if not title:
        return title
    original = title.strip()
    cleaned = _CURRICULUM_PREFIX.sub("", original).strip()
    return cleaned or original
