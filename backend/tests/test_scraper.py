from seeds.scraper import make_slug, parse_py_file, parse_readme

SAMPLE_README = """
| # | Title | Solution | Difficulty |
|---| ----- | -------- | ---------- |
|53|[Maximum Subarray](https://example.com/problems/maximum-subarray/)|[Python](./1-100q/53.py)|Easy|
|4|[Median of Two Sorted Arrays](https://example.com/problems/median-of-two-sorted-arrays/)|[Python](./1-100q/4.py)|Hard|
|70|[Climbing Stairs](https://example.com/problems/climbing-stairs/)|[Python](./1-100q/70.py)|Easy|
"""

SAMPLE_PY = """'''
\tGiven an integer array nums, find the contiguous subarray (containing at least one number)
\twhich has the largest sum and return its sum.

\tExample:

\tInput: [-2,1,-3,4,-1,2,1,-5,4],
\tOutput: 6
\tExplanation: [4,-1,2,1] has the largest sum = 6.

\tNote: If you have figured out the O(n) solution, try coding another solution using
\tthe divide and conquer approach, which is more subtle.
'''

class Solution(object):
    def maxSubArray(self, nums):
        currSum, result = nums[0], nums[0]
        for i in range(1, len(nums)):
            currSum = max(nums[i], currSum + nums[i])
            result = max(result, currSum)
        return result

# Time: O(N)
# Space: O(1)
"""

SAMPLE_PY_NO_DOCSTRING = """
class Solution(object):
    def solve(self):
        return 42
"""


def test_parse_readme_extracts_title():
    result = parse_readme(SAMPLE_README)
    assert 53 in result
    assert result[53]["title"] == "Maximum Subarray"


def test_parse_readme_extracts_difficulty():
    result = parse_readme(SAMPLE_README)
    assert result[53]["difficulty"] == "easy"
    assert result[4]["difficulty"] == "hard"


def test_parse_readme_extracts_file_path():
    result = parse_readme(SAMPLE_README)
    assert result[53]["file_path"] == "1-100q/53.py"


def test_parse_readme_extracts_source_url():
    result = parse_readme(SAMPLE_README)
    assert "maximum-subarray" in result[53]["source_url"]


def test_parse_py_file_extracts_description():
    result = parse_py_file(SAMPLE_PY)
    assert "largest sum" in result["description"]
    assert len(result["description"]) > 20


def test_parse_py_file_extracts_example():
    result = parse_py_file(SAMPLE_PY)
    assert len(result["examples"]) >= 1
    assert result["examples"][0]["input"] != ""
    assert result["examples"][0]["output"] != ""


def test_parse_py_file_extracts_complexity():
    result = parse_py_file(SAMPLE_PY)
    assert result["time_complexity"] == "O(N)"
    assert result["space_complexity"] == "O(1)"


def test_parse_py_file_extracts_solution_code():
    result = parse_py_file(SAMPLE_PY)
    assert "class Solution" in result["solution_code"]
    assert "maxSubArray" in result["solution_code"]


def test_parse_py_file_handles_no_docstring():
    result = parse_py_file(SAMPLE_PY_NO_DOCSTRING)
    assert result["description"] == ""
    assert result["examples"] == []
    assert "class Solution" in result["solution_code"]


def test_make_slug_basic():
    assert make_slug("Maximum Subarray") == "maximum-subarray"


def test_make_slug_with_numbers():
    assert make_slug("Two Sum") == "two-sum"


def test_make_slug_with_special_chars():
    assert make_slug("N-Queens II") == "n-queens-ii"
    assert make_slug("3Sum Closest") == "3sum-closest"
