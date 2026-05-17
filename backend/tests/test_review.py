"""Tests for code review helpers."""

from llm.review import extract_improved_code


def test_extract_improved_code_skips_when_verdict_correct():
    review = """## Verdict
Correct — meets the requirements.

## Tip
You could add a main guard for scripts."""
    assert extract_improved_code(review, "python") is None


def test_extract_improved_code_parses_fence():
    review = """## Verdict
Needs work — missing output.

## Fix
- Wrong function

## Improved Code
```python
print("hi")
```
## Why
Fixed."""
    assert extract_improved_code(review, "python") == 'print("hi")'
