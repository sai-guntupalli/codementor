"""Tests for problem statement normalization helpers."""

from core.problem_content import (
    extract_hints_from_description,
    has_placeholder_examples,
    needs_normalize,
    normalize_title,
    pre_clean_description,
    validate_normalized,
)


SAMPLE_README = """\
# `01.5` Add items to the list

## 📝 Instructions:

1. Add 10 random integers to `my_list`.

## 💡 Hints:

+ You have to `import random` module.

+ Use the `random.randint()` function.
"""


def test_normalize_title_strips_curriculum():
    assert normalize_title("`01.5` Add items to the list") == "Add items to the list"


def test_extract_hints_and_instructions():
    desc, hints = extract_hints_from_description(SAMPLE_README)
    assert "Instructions" not in desc
    assert "Hints" not in desc
    assert len(hints) >= 2
    assert "random" in hints[0].lower()


def test_pre_clean_removes_emoji_and_heading():
    cleaned, hints = pre_clean_description(SAMPLE_README)
    assert "📝" not in cleaned
    assert "`01.5`" not in cleaned
    assert len(hints) >= 1


def test_has_placeholder_examples():
    assert has_placeholder_examples([{"input": "(see description)", "output": "(see solution)"}])
    assert not has_placeholder_examples([{"input": "3\n5", "output": "8"}])
    assert not has_placeholder_examples(
        [{"input": "34", "output": "peanuts\nchocolate"}]
    )


def test_needs_normalize_detects_readme_style():
    assert needs_normalize(
        title="Add items to the list",
        description=SAMPLE_README,
        examples=[{"input": "(see description)", "output": "(see solution)"}],
    )


def test_validate_normalized_accepts_good_payload():
    errors = validate_normalized(
        title="Add items to the list",
        description="Add 10 random integers to `my_list` using `random.randint()`.",
        examples=[
            {"input": "(none)", "output": "[1, 4, 2, 9, 3, 7, 8, 0, 5, 6]"},
            {"input": "(none)", "output": "[10, 2, 8, 1, 4, 9, 3, 7, 0, 5]"},
        ],
        constraints="Use the random module.",
    )
    assert errors == []
