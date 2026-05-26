"""Run problem examples against user code (submission verify)."""

from dataclasses import dataclass

from core.piston_runner import is_runnable_example, normalize_output, run_code


@dataclass
class ExampleTestResult:
    index: int
    input: str
    expected: str
    actual: str
    stderr: str
    passed: bool
    timed_out: bool
    exit_code: int | None


def _normalize_examples(examples: list | dict) -> list[dict]:
    if isinstance(examples, list):
        return [ex for ex in examples if isinstance(ex, dict)]
    if isinstance(examples, dict) and examples:
        return [examples]
    return []


async def run_problem_examples(
    *,
    language: str,
    code: str,
    examples: list | dict,
) -> list[ExampleTestResult]:
    """Execute each runnable example; skip non-stdin fixtures."""
    runnable = [
        ex
        for ex in _normalize_examples(examples)
        if is_runnable_example(str(ex.get("input", "")))
    ]

    results: list[ExampleTestResult] = []
    for i, ex in enumerate(runnable):
        raw_input = str(ex.get("input", ""))
        expected = normalize_output(str(ex.get("output", "")))
        try:
            run = await run_code(language=language, code=code, stdin=raw_input)
            actual = normalize_output(run.stdout)
            passed = (
                not run.timed_out
                and run.exit_code == 0
                and actual == expected
            )
            results.append(
                ExampleTestResult(
                    index=i,
                    input=raw_input,
                    expected=expected,
                    actual=actual,
                    stderr=run.stderr or "",
                    passed=passed,
                    timed_out=run.timed_out,
                    exit_code=run.exit_code,
                )
            )
        except Exception as exc:
            results.append(
                ExampleTestResult(
                    index=i,
                    input=raw_input,
                    expected=expected,
                    actual="",
                    stderr=str(exc),
                    passed=False,
                    timed_out=False,
                    exit_code=1,
                )
            )
    return results
