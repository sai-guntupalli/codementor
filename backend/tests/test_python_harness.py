"""Tests for function-style Python execution harness."""

from core.python_harness import (
    guess_entry_function,
    should_use_function_harness,
    wrap_python_function_harness,
)


def test_guess_entry_function():
    code = """
def helper():
    pass

def reverse_list(items):
    return items[::-1]
"""
    assert guess_entry_function(code) == "reverse_list"


def test_should_use_harness_for_function_without_input():
    code = "def reverse_list(x):\n    return x[::-1]\n"
    assert should_use_function_harness(code, "[1, 2, 3]")
    assert not should_use_function_harness(code + "x = input()\n", "[1, 2, 3]")
    assert not should_use_function_harness(code, "4\n5")


def test_wrap_calls_function_with_list_literal():
    code = "def reverse_list(input_list):\n    return input_list[::-1]\n"
    wrapped = wrap_python_function_harness(code, "[1, 2, 3]")
    assert wrapped is not None
    assert "reverse_list" in wrapped
    ns: dict = {}
    exec(wrapped, ns)  # noqa: S102
    assert ns.get("__cm_result") == [3, 2, 1]
