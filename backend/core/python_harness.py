"""Wrap function-style Python solutions so example inputs invoke the user's function."""

from __future__ import annotations

import ast
import base64
import re

_DEF_RE = re.compile(r"^def\s+([a-zA-Z_][\w]*)\s*\(", re.MULTILINE)
_SKIP_NAMES = frozenset({"main", "test", "run", "setup", "teardown"})


def guess_entry_function(code: str) -> str | None:
    """Pick the most likely user function to call (last top-level public def)."""
    names = []
    for match in _DEF_RE.finditer(code):
        name = match.group(1)
        if name.startswith("_") or name in _SKIP_NAMES:
            continue
        names.append(name)
    if not names:
        return None
    return names[-1]


def stdin_looks_like_literal(stdin: str) -> bool:
    raw = stdin.strip()
    if not raw or raw == "(none)":
        return False
    # Multi-line stdin is usually several input() calls, not one function arg.
    if "\n" in raw:
        return False
    try:
        ast.literal_eval(raw)
        return True
    except (ValueError, SyntaxError):
        return False


def should_use_function_harness(code: str, stdin: str) -> bool:
    """Use harness when the user defined a function but did not read stdin themselves."""
    if "input(" in code:
        return False
    if guess_entry_function(code) is None:
        return False
    return stdin_looks_like_literal(stdin)


def wrap_python_function_harness(
    code: str,
    stdin: str,
    *,
    entry_function: str | None = None,
) -> str | None:
    """
    Append a driver that parses stdin as a Python literal and calls entry_function.

    Returns None if harness does not apply.
    """
    if not should_use_function_harness(code, stdin):
        return None

    fn = entry_function or guess_entry_function(code)
    if not fn:
        return None

    stdin_b64 = base64.b64encode(stdin.strip().encode("utf-8")).decode("ascii")

    driver = f'''

# --- CodeMentor harness: call your function with the example input ---
import ast as __cm_ast
import base64 as __cm_b64

__cm_stdin = __cm_b64.b64decode("{stdin_b64}").decode("utf-8")
__cm_arg = __cm_ast.literal_eval(__cm_stdin.strip())
__cm_result = {fn}(*__cm_arg) if isinstance(__cm_arg, tuple) else {fn}(__cm_arg)
if __cm_result is not None:
    print(__cm_result)
'''
    return code.rstrip() + driver
