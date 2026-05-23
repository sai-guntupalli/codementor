"""Tests for Garvit244/Leetcode scraper parsers."""

from seeds.scrapers.garvit_leetcode import (
    build_problem_record,
    make_slug,
    normalize_difficulty,
    parse_py_file,
    parse_readme,
)

SAMPLE_README = """
| # | Title | Solution | Difficulty |
|---| ----- | -------- | ---------- |
|53|[Maximum Subarray](https://leetcode.com/problems/maximum-subarray/)|[Python](./1-100q/53.py)|Easy|
|4|[Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/)|[Python](./1-100q/4.py)|Hard|
"""

SAMPLE_PY = """'''
\tGiven an integer array nums, find the contiguous subarray which has the largest sum.

\tExample:

\tInput: [-2,1,-3,4,-1,2,1,-5,4],
\tOutput: 6
\tExplanation: [4,-1,2,1] has the largest sum = 6.
'''

class Solution(object):
    def maxSubArray(self, nums):
        return sum(nums)

# Time: O(N)
# Space: O(1)
"""


def test_parse_readme():
    result = parse_readme(SAMPLE_README)
    assert 53 in result
    assert result[53]["title"] == "Maximum Subarray"
    assert result[53]["difficulty"] == "easy"
    assert result[4]["difficulty"] == "hard"
    assert result[53]["file_path"] == "1-100q/53.py"


def test_parse_py_file():
    result = parse_py_file(SAMPLE_PY)
    assert "largest sum" in result["description"]
    assert len(result["examples"]) >= 1
    assert "class Solution" in result["solution_code"]
    assert result["time_complexity"] == "O(N)"


def test_make_slug():
    assert make_slug("Two Sum") == "two-sum"


def test_normalize_difficulty():
    assert normalize_difficulty("Medium") == "medium"


def test_build_problem_record():
    meta = {
        "external_id": 53,
        "title": "Maximum Subarray",
        "source_url": "https://leetcode.com/problems/maximum-subarray/",
        "difficulty": "easy",
    }
    parsed = parse_py_file(SAMPLE_PY)
    rec = build_problem_record(meta, parsed)
    assert rec["slug"] == "maximum-subarray"
    assert rec["sort_order"] == 10053
    assert rec["examples"]
