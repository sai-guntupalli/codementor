"""Normalize stdin for Piston (Python input() / readline)."""


def normalize_stdin(raw: str) -> str:
    """Prepare stdin text for subprocess execution."""
    s = raw.strip()
    if not s or s.lower() == "(none)":
        return ""
    # JSON/UI sometimes stores literal backslash-n instead of newlines
    s = s.replace("\\n", "\n")
    if not s.endswith("\n"):
        s += "\n"
    return s
