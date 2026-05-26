"""Build editor starter templates for practice problems."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy import case
from sqlalchemy.orm import Session

from core.function_fixture import (
    call_hint_from_signature,
    parse_assignment_bindings,
    stdin_looks_like_assignment_fixture,
)
from core.python_harness import stdin_looks_like_function_call
from models.learning import Problem, ProblemSolution

_SKIP_DEF_NAMES = frozenset({"main", "test", "run", "setup", "teardown"})

_PYTHON_HEADER = "# Write your solution below\n\n"
_SQL_HEADER = "-- Write your query below\n\n"


@dataclass
class StarterInfo:
    starter_code: str
    entry_function: str | None = None
    test_call: str | None = None


def _normalize_examples(examples: list | dict | None) -> list[dict]:
    if isinstance(examples, list):
        return [ex for ex in examples if isinstance(ex, dict)]
    if isinstance(examples, dict) and examples:
        return [examples]
    return []


def _corpus(problem: Problem) -> str:
    parts = [problem.description or ""]
    if problem.constraints:
        parts.append(problem.constraints)
    return "\n".join(parts)


def _parse_function_call(input_text: str) -> tuple[str, int] | None:
    raw = input_text.strip()
    match = re.match(r"^([a-z_]\w*)\s*\(([\s\S]*)\)\s*$", raw, re.I)
    if not match:
        return None
    name = match.group(1)
    args_inner = match.group(2).strip()
    if not args_inner:
        return name, 0
    arg_count = 1
    depth = 0
    for ch in args_inner:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            arg_count += 1
    return name, arg_count


def _default_params(arg_count: int) -> str:
    defaults: dict[int, list[str]] = {
        0: [],
        1: ["input_list"],
        2: ["input_list", "person"],
        3: ["input_list", "person", "arg3"],
    }
    names = defaults.get(arg_count) or [f"arg{i + 1}" for i in range(arg_count)]
    return ", ".join(names[:arg_count])


def _extract_def_from_text(text: str, *, preferred_name: str | None = None) -> tuple[str, str] | None:
    if preferred_name:
        escaped = re.escape(preferred_name)
        m = re.search(rf"def\s+({escaped})\s*\(([^)]*)\)", text, re.I)
        if m:
            return m.group(1), m.group(2).strip()

    for m in re.finditer(r"def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)", text):
        name = m.group(1)
        if name.startswith("_") or name.lower() in _SKIP_DEF_NAMES:
            continue
        return name, m.group(2).strip()

    if preferred_name:
        escaped = re.escape(preferred_name)
        m = re.search(rf"`{escaped}\s*\(([^)]*)\)`", text, re.I)
        if m:
            return preferred_name, m.group(1).strip()

    return None


def _extract_class_solution(text: str) -> str | None:
    m = re.search(
        r"class\s+Solution\s*:.*?\n\s+def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)",
        text,
        re.DOTALL | re.I,
    )
    if not m:
        return None
    return f"class Solution:\n    def {m.group(1)}({m.group(2)})"


def _extract_from_solution_code(code: str) -> str | None:
    class_sig = _extract_class_solution(code)
    if class_sig:
        return class_sig

    defs: list[tuple[str, str]] = []
    for m in re.finditer(r"^def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*:", code, re.M):
        name = m.group(1)
        if name.startswith("_") or name.lower() in _SKIP_DEF_NAMES:
            continue
        defs.append((name, m.group(2).strip()))
    if defs:
        name, params = defs[-1]
        return f"def {name}({params})"
    return None


def _has_function_call_example(examples: list[dict]) -> bool:
    for ex in examples:
        inp = str(ex.get("input", "")).strip()
        if stdin_looks_like_function_call(inp):
            return True
        if _parse_function_call(inp):
            return True
    return False


def _has_assignment_example(examples: list[dict]) -> bool:
    return any(
        stdin_looks_like_assignment_fixture(str(ex.get("input", ""))) for ex in examples
    )


def _is_script_stdin_problem(problem: Problem, examples: list[dict]) -> bool:
    corpus = _corpus(problem)
    if _extract_class_solution(corpus) or _extract_def_from_text(corpus):
        return False
    if _has_function_call_example(examples):
        return False
    if _has_assignment_example(examples):
        return False
    if re.search(r"\b(implement|write|complete|define)\s+(a\s+)?function\b", corpus, re.I):
        return False

    runnable = [
        ex
        for ex in examples
        if str(ex.get("input", "")).strip() not in ("", "(none)", "(see description)", "(see problem)")
    ]
    if not runnable:
        return False
    return True


def _format_python_starter(signature: str, *, test_call: str | None = None) -> str:
    del test_call  # kept in API for harness; not shown in editor template
    header = _PYTHON_HEADER
    if signature.startswith("class Solution"):
        return f"{header}{signature}:\n        pass\n"
    return f"{header}{signature}:\n    pass\n"


def _signature_metadata(signature: str) -> tuple[str | None, str | None]:
    call = call_hint_from_signature(signature)
    if signature.startswith("class Solution"):
        m = re.search(r"def\s+([a-zA-Z_]\w*)\s*\(", signature)
        return (m.group(1) if m else None, call)
    m = re.match(r"def\s+([a-zA-Z_]\w*)\s*\(", signature)
    return (m.group(1) if m else None, call)


def _infer_test_call_from_examples(
    signature: str,
    examples: list[dict],
) -> str | None:
    hint = call_hint_from_signature(signature)
    if hint:
        return hint

    m = re.match(r"def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)", signature.strip())
    if not m:
        return None
    fn_name, params_str = m.group(1), m.group(2).strip()
    param_names = [p.strip() for p in params_str.split(",") if p.strip()]

    for ex in examples:
        bindings = parse_assignment_bindings(str(ex.get("input", "")))
        if not bindings:
            continue
        names = param_names or list(bindings.keys())
        args = [bindings.get(n) for n in names]
        if all(a is not None for a in args):
            return f"{fn_name}({', '.join(args)})"  # type: ignore[arg-type]
    return None


def _get_reference_solution(db: Session, problem_id: uuid.UUID) -> ProblemSolution | None:
    return (
        db.query(ProblemSolution)
        .filter(
            ProblemSolution.problem_id == problem_id,
            ProblemSolution.language == "python",
        )
        .order_by(
            ProblemSolution.is_primary.desc(),
            case((ProblemSolution.variant == "original", 0), else_=1),
        )
        .first()
    )


def build_starter_info(problem: Problem, db: Session) -> StarterInfo:
    lang = (problem.language or "python").lower()
    if lang == "sql":
        return StarterInfo(starter_code=_SQL_HEADER)
    if lang != "python":
        return StarterInfo(starter_code="# Write your code below\n\n")

    examples = _normalize_examples(problem.examples)

    solution = _get_reference_solution(db, problem.id)
    if solution and solution.code.strip():
        sig = _extract_from_solution_code(solution.code)
        if sig:
            entry_fn, test_call = _signature_metadata(sig)
            test_call = _infer_test_call_from_examples(sig, examples) or test_call
            return StarterInfo(
                starter_code=_format_python_starter(sig, test_call=test_call),
                entry_function=entry_fn,
                test_call=test_call,
            )

    if _is_script_stdin_problem(problem, examples):
        return StarterInfo(starter_code=_PYTHON_HEADER)

    inferred_sig: str | None = None
    corpus = _corpus(problem)
    class_sig = _extract_class_solution(corpus)
    if class_sig:
        inferred_sig = class_sig
    else:
        call_name: str | None = None
        arg_count = 0
        for ex in examples:
            parsed = _parse_function_call(str(ex.get("input", "")))
            if parsed:
                call_name, arg_count = parsed
                break
        from_text = _extract_def_from_text(corpus, preferred_name=call_name)
        if from_text:
            name, params = from_text
            inferred_sig = f"def {name}({params})"
        elif call_name:
            inferred_sig = f"def {call_name}({_default_params(arg_count)})"
        else:
            standalone = _extract_def_from_text(corpus)
            if standalone:
                name, params = standalone
                inferred_sig = f"def {name}({params})"
            elif _has_assignment_example(examples):
                first = parse_assignment_bindings(str(examples[0].get("input", "")))
                if first:
                    keys = list(first.keys())
                    fn_guess = call_name or "solve"
                    inferred_sig = f"def {fn_guess}({', '.join(keys)})"

    if inferred_sig:
        entry_fn, test_call = _signature_metadata(inferred_sig)
        test_call = _infer_test_call_from_examples(inferred_sig, examples) or test_call
        return StarterInfo(
            starter_code=_format_python_starter(inferred_sig, test_call=test_call),
            entry_function=entry_fn,
            test_call=test_call,
        )

    return StarterInfo(starter_code=_PYTHON_HEADER)


def build_starter_code(problem: Problem, db: Session) -> str:
    return build_starter_info(problem, db).starter_code
