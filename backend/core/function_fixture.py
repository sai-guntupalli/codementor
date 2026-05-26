"""Parse LeetCode-style example fixtures and build function calls for the harness."""

from __future__ import annotations

import ast
import re

_DEF_RE = re.compile(r"^def\s+([a-zA-Z_][\w]*)\s*\(", re.MULTILINE)
_SKIP_NAMES = frozenset({"main", "test", "run", "setup", "teardown"})


def guess_entry_function(code: str) -> str | None:
    names: list[str] = []
    for match in _DEF_RE.finditer(code):
        name = match.group(1)
        if name.startswith("_") or name in _SKIP_NAMES:
            continue
        names.append(name)
    return names[-1] if names else None


_ASSIGNMENT_LINE = re.compile(
    r"^\s*([a-zA-Z_]\w*)\s*=\s*(.+?)\s*$",
)


def parse_assignment_bindings(stdin: str) -> dict[str, str] | None:
    """
    Parse fixtures like:
        list1 = [1, 2, 3]
        list2 = [4, 5, 6]
    Returns {name: rhs_source} or None if not a pure assignment block.
    """
    text = stdin.strip()
    if not text or text in ("(none)", "(see description)", "(see problem)"):
        return None

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None

    bindings: dict[str, str] = {}
    for line in lines:
        m = _ASSIGNMENT_LINE.match(line)
        if not m:
            return None
        name, rhs = m.group(1), m.group(2).strip()
        try:
            ast.parse(rhs, mode="eval")
        except SyntaxError:
            return None
        bindings[name] = rhs

    return bindings if bindings else None


def stdin_looks_like_assignment_fixture(stdin: str) -> bool:
    return parse_assignment_bindings(stdin) is not None


def get_function_param_names(code: str, fn_name: str) -> list[str]:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []

    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == fn_name:
            return [
                arg.arg
                for arg in node.args.args
                if arg.arg not in ("self", "cls")
            ]
    return []


def build_call_from_assignment_fixture(
    stdin: str,
    code: str,
    fn_name: str | None = None,
) -> str | None:
    bindings = parse_assignment_bindings(stdin)
    if not bindings:
        return None

    name = fn_name or guess_entry_function(code)
    if not name:
        return None

    params = get_function_param_names(code, name)
    if not params:
        params = list(bindings.keys())

    args: list[str] = []
    for param in params:
        if param not in bindings:
            return None
        args.append(bindings[param])

    return f"{name}({', '.join(args)})"


def call_hint_from_signature(signature: str) -> str | None:
    """Turn 'def merge_lists(list1, list2)' into 'merge_lists(list1, list2)'."""
    m = re.match(r"def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*$", signature.strip())
    if m:
        params = m.group(2).strip()
        return f"{m.group(1)}({params})" if params else f"{m.group(1)}()"

    m = re.match(
        r"class\s+Solution\s*:\s*\n\s*def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*$",
        signature.strip(),
        re.DOTALL,
    )
    if m:
        return f"Solution().{m.group(1)}({m.group(2).strip()})"

    return None


def resolve_example_invocation(stdin: str, code: str) -> str | None:
    """Best-effort description of how Run/Submit will invoke user code for this input."""
    raw = stdin.strip()
    if stdin_looks_like_assignment_fixture(raw):
        return build_call_from_assignment_fixture(raw, code)
    if raw.startswith("def ") or raw.startswith("class "):
        return call_hint_from_signature(raw)
    try:
        tree = ast.parse(raw, mode="eval")
        if isinstance(tree.body, ast.Call) and isinstance(tree.body.func, ast.Name):
            return raw
    except SyntaxError:
        pass
    fn = guess_entry_function(code)
    if fn and stdin_looks_like_literal_simple(raw):
        return f"{fn}({raw})"
    return None


def stdin_looks_like_literal_simple(stdin: str) -> bool:
    raw = stdin.strip()
    if not raw or "\n" in raw:
        return False
    try:
        ast.literal_eval(raw)
        return True
    except (ValueError, SyntaxError):
        return False
