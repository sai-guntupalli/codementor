"""Tests for curriculum title prefix stripping."""

from core.problem_titles import strip_curriculum_prefix


def test_strip_backtick_decimal_prefix():
    assert strip_curriculum_prefix("`01.5` Add items to the list") == "Add items to the list"


def test_strip_plain_decimal_prefix():
    assert strip_curriculum_prefix("02.1 Loop from the end") == "Loop from the end"


def test_strip_three_digit_prefix():
    assert strip_curriculum_prefix("`026` Two dimensional list") == "Two dimensional list"


def test_strip_two_digit_module_only():
    assert strip_curriculum_prefix("05 Sum all items") == "Sum all items"


def test_strip_nine_module_subexercise():
    assert strip_curriculum_prefix("09.1 Minimum Integer") == "Minimum Integer"


def test_leaves_normal_titles():
    assert strip_curriculum_prefix("Hello, Print") == "Hello, Print"
    assert strip_curriculum_prefix("Two Sum") == "Two Sum"
