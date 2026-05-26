"""Wrap function-style Python solutions so example inputs invoke the user's function."""

from __future__ import annotations

import ast
import base64
import re

from core.function_fixture import (
    build_call_from_assignment_fixture,
    guess_entry_function,
    stdin_looks_like_assignment_fixture,
)


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


def stdin_looks_like_function_call(stdin: str) -> bool:
    """Example input like delete_person([1, 2], 'x') from problem statements."""
    raw = stdin.strip()
    if not raw or raw == "(none)":
        return False
    try:
        tree = ast.parse(raw, mode="eval")
    except SyntaxError:
        return False
    expr = tree.body
    return isinstance(expr, ast.Call) and isinstance(expr.func, ast.Name)


def should_use_function_harness(code: str, stdin: str) -> bool:
    """Use harness when the user defined a function but did not read stdin themselves."""
    if "input(" in code:
        return False
    if guess_entry_function(code) is None:
        return False
    return (
        stdin_looks_like_literal(stdin)
        or stdin_looks_like_function_call(stdin)
        or (
            stdin_looks_like_assignment_fixture(stdin)
            and guess_entry_function(code) is not None
        )
    )


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

    raw = stdin.strip()

    if stdin_looks_like_assignment_fixture(raw):
        fn = entry_function or guess_entry_function(code)
        if fn:
            call = build_call_from_assignment_fixture(raw, code, fn)
            if call:
                call_b64 = base64.b64encode(call.encode("utf-8")).decode("ascii")
                driver = f'''

# --- CodeMentor harness: run the example function call ---
import base64 as __cm_b64

__cm_call = __cm_b64.b64decode("{call_b64}").decode("utf-8")
__cm_result = eval(__cm_call)
if __cm_result is not None:
    print(__cm_result)
'''
                return code.rstrip() + driver

    if stdin_looks_like_function_call(raw):
        call_b64 = base64.b64encode(raw.encode("utf-8")).decode("ascii")
        driver = f'''

# --- CodeMentor harness: run the example function call ---
import base64 as __cm_b64

__cm_call = __cm_b64.b64decode("{call_b64}").decode("utf-8")
__cm_result = eval(__cm_call)
if __cm_result is not None:
    print(__cm_result)
'''
        return code.rstrip() + driver

    fn = entry_function or guess_entry_function(code)
    if not fn:
        return None

    stdin_b64 = base64.b64encode(raw.encode("utf-8")).decode("ascii")

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
