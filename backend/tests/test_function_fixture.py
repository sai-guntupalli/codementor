"""Assignment-style example fixtures and function-call building."""

from core.function_fixture import (
    build_call_from_assignment_fixture,
    parse_assignment_bindings,
    stdin_looks_like_assignment_fixture,
)
from core.piston_runner import is_runnable_example
from core.python_harness import wrap_python_function_harness


def test_parse_assignment_bindings_multiline():
    raw = "list1 = [1, 2, 3]\nlist2 = [4, 5, 6]"
    assert parse_assignment_bindings(raw) == {
        "list1": "[1, 2, 3]",
        "list2": "[4, 5, 6]",
    }
    assert stdin_looks_like_assignment_fixture(raw)


def test_build_call_from_assignments():
    code = "def merge_lists(list1, list2):\n    return list1 + list2\n"
    raw = "list1 = [1, 2, 3]\nlist2 = [4, 5, 6]"
    assert build_call_from_assignment_fixture(raw, code) == "merge_lists([1, 2, 3], [4, 5, 6])"


def test_assignment_examples_are_runnable():
    assert is_runnable_example("list1 = [1]\nlist2 = [2]")


def test_harness_runs_assignment_fixture():
    code = "def merge_lists(list1, list2):\n    return list1 + list2\n"
    stdin = "list1 = [1, 2, 3]\nlist2 = [4, 5, 6]"
    wrapped = wrap_python_function_harness(code, stdin)
    assert wrapped is not None
    ns: dict = {}
    exec(wrapped, ns)  # noqa: S102
    assert ns.get("__cm_result") == [1, 2, 3, 4, 5, 6]
