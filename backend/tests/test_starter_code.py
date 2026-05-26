"""Starter template inference for practice editor."""

import uuid

from core.starter_code import build_starter_code
from models.learning import Problem, ProblemSolution


def test_script_stdin_problem_gets_plain_stub(db):
    problem = Problem(
        id=uuid.uuid4(),
        title="Add Two Numbers",
        description="Read two integers from stdin and print their sum.",
        difficulty="easy",
        language="python",
        examples=[{"input": "3\n5", "output": "8"}],
        source="curated",
    )
    db.add(problem)
    db.commit()

    starter = build_starter_code(problem, db)
    assert starter == "# Write your solution below\n\n"
    assert "def " not in starter


def test_assignment_examples_get_call_hint(db):
    problem = Problem(
        id=uuid.uuid4(),
        title="Merge Two Lists",
        description="Write a function that merges two lists in order.",
        difficulty="easy",
        language="python",
        examples=[
            {"input": "list1 = [1, 2, 3]\nlist2 = [4, 5, 6]", "output": "[1, 2, 3, 4, 5, 6]"},
        ],
        source="curated",
    )
    db.add(problem)
    db.flush()
    db.add(
        ProblemSolution(
            problem_id=problem.id,
            language="python",
            variant="original",
            code="def merge_lists(list1, list2):\n    return list1 + list2\n",
            is_primary=True,
        )
    )
    db.commit()

    from core.starter_code import build_starter_info

    info = build_starter_info(problem, db)
    assert info.entry_function == "merge_lists"
    assert info.test_call == "merge_lists(list1, list2)"
    assert "def merge_lists(list1, list2)" in info.starter_code


def test_function_call_examples_get_def_stub(db):
    problem = Problem(
        id=uuid.uuid4(),
        title="Delete Person",
        description="Implement delete_person to remove a name from a list.",
        difficulty="easy",
        language="python",
        examples=[
            {
                "input": "delete_person(['John', 'Jane'], 'Jane')",
                "output": "['John']",
            }
        ],
        source="curated",
    )
    db.add(problem)
    db.commit()

    starter = build_starter_code(problem, db)
    assert "def delete_person(" in starter
    assert "pass" in starter


def test_solution_code_defines_signature(db):
    problem = Problem(
        id=uuid.uuid4(),
        title="Two Sum",
        description="Return indices of two numbers that add up to target.",
        difficulty="easy",
        language="python",
        examples=[{"input": "nums = [2,7], target = 9", "output": "[0,1]"}],
        source="imported",
    )
    db.add(problem)
    db.flush()

    db.add(
        ProblemSolution(
            problem_id=problem.id,
            language="python",
            variant="original",
            code=(
                "class Solution:\n"
                "    def twoSum(self, nums, target):\n"
                "        pass\n"
            ),
            is_primary=True,
        )
    )
    db.commit()

    starter = build_starter_code(problem, db)
    assert "class Solution:" in starter
    assert "def twoSum(self, nums, target)" in starter
