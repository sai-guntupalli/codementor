"""Fix empty-tag problems, remove placeholders, correct misclassifications, add new problems.

Run with:  python -m seeds.fix_and_expand_problems
"""

from __future__ import annotations

import sys

from db.session import SessionLocal
from models.learning import Problem

# ---------------------------------------------------------------------------
# 1. Tag assignments for 98 empty-tag problems (LeetCode imports)
# ---------------------------------------------------------------------------

EMPTY_TAG_FIXES: list[tuple[str, str, list[str]]] = [
    # (title, difficulty_override_or_empty, new_tags)
    # '' means keep existing difficulty
    # Linked List
    ("Palindrome Linked List", "", ["linked-list", "two-pointers", "recursion"]),
    ("Remove Linked List Elements", "", ["linked-list", "arrays"]),
    ("Insertion Sort List", "", ["linked-list", "sorting"]),
    ("Linked List Cycle", "", ["linked-list", "two-pointers"]),
    ("Merge k Sorted Lists", "", ["linked-list", "sorting", "hash-map"]),
    ("Partition List", "", ["linked-list", "two-pointers"]),
    ("Remove Nth Node From End of List", "", ["linked-list", "two-pointers"]),
    ("Reorder List", "", ["linked-list", "two-pointers", "recursion"]),
    ("Reverse Linked List II", "", ["linked-list", "two-pointers"]),
    ("Reverse Nodes in k-Group", "", ["linked-list", "recursion"]),
    ("Rotate List", "", ["linked-list", "two-pointers"]),
    ("Swap Nodes in Pairs", "", ["linked-list", "recursion"]),
    # Binary Trees
    ("Binary Tree Zigzag Level Order Traversal", "", ["binary-tree", "queue", "arrays"]),
    ("Construct Binary Tree from Inorder and Postorder Traversal", "", ["binary-tree", "recursion", "arrays"]),
    ("Kth Smallest Element in a BST", "", ["binary-tree", "binary-search", "recursion"]),
    ("Path Sum", "", ["binary-tree", "recursion"]),
    ("Populating Next Right Pointers in Each Node", "", ["binary-tree", "queue", "recursion"]),
    ("Same Tree", "", ["binary-tree", "recursion"]),
    ("Symmetric Tree", "", ["binary-tree", "recursion"]),
    ("Unique Binary Search Trees II", "", ["binary-tree", "dynamic-programming", "recursion"]),
    ("Validate Binary Search Tree", "", ["binary-tree", "recursion", "searching"]),
    # Graph
    ("Course Schedule", "", ["graph", "arrays", "searching"]),
    ("Number of Islands", "", ["graph", "matrix", "searching"]),
    ("Surrounded Regions", "", ["graph", "matrix", "searching"]),
    ("Word Ladder", "", ["graph", "strings", "searching"]),
    # Dynamic Programming
    ("Best Time to Buy and Sell Stock III", "", ["dynamic-programming", "arrays"]),
    ("Climbing Stairs", "easy", ["dynamic-programming", "math", "recursion"]),
    ("Decode Ways", "", ["dynamic-programming", "strings"]),
    ("Distinct Subsequences", "", ["dynamic-programming", "strings"]),
    ("Edit Distance", "", ["dynamic-programming", "strings"]),
    ("Interleaving String", "", ["dynamic-programming", "strings", "recursion"]),
    ("Jump Game II", "", ["dynamic-programming", "greedy", "arrays"]),
    ("Maximum Product Subarray", "", ["dynamic-programming", "arrays"]),
    ("Maximum Subarray", "", ["dynamic-programming", "arrays"]),
    ("Minimum Path Sum", "", ["dynamic-programming", "matrix"]),
    ("Scramble String", "", ["dynamic-programming", "recursion", "strings"]),
    ("Unique Paths II", "", ["dynamic-programming", "matrix"]),
    ("Word Break", "", ["dynamic-programming", "strings", "hash-map"]),
    ("Palindrome Partitioning", "", ["backtracking", "strings", "dynamic-programming"]),
    # Arrays / Two Pointers
    ("3Sum", "", ["arrays", "two-pointers", "sorting"]),
    ("3Sum Closest", "", ["arrays", "two-pointers", "sorting"]),
    ("4Sum", "", ["arrays", "two-pointers", "sorting"]),
    ("Container With Most Water", "", ["arrays", "two-pointers"]),
    ("Gas Station", "", ["arrays", "greedy", "simulation"]),
    ("Next Permutation", "", ["arrays", "two-pointers"]),
    ("Product of Array Except Self", "", ["arrays", "math"]),
    ("Remove Duplicates from Sorted Array", "", ["arrays", "two-pointers"]),
    ("Rotate Image", "", ["matrix", "arrays"]),
    ("Set Matrix Zeroes", "", ["matrix", "arrays", "hash-map"]),
    ("Sort Colors", "", ["arrays", "sorting", "two-pointers"]),
    ("Trapping Rain Water", "", ["arrays", "two-pointers", "stack"]),
    ("Missing Ranges", "", ["arrays", "searching"]),
    ("Moving Stones Until Consecutive", "easy", ["arrays", "math", "searching"]),
    # Strings
    ("Add Binary", "", ["strings", "math"]),
    ("Count and Say", "", ["strings", "loops", "simulation"]),
    ("Longest Palindromic Substring", "", ["strings", "dynamic-programming"]),
    ("Longest Substring Without Repeating Characters", "", ["strings", "hash-map", "two-pointers"]),
    ("Longest Valid Parentheses", "", ["strings", "stack", "dynamic-programming"]),
    ("Valid Palindrome", "", ["strings", "two-pointers"]),
    ("ZigZag Conversion", "", ["strings", "simulation"]),
    ("Restore IP Addresses", "", ["strings", "backtracking"]),
    # Backtracking
    ("Combination Sum", "", ["backtracking", "arrays", "recursion"]),
    ("Generate Parentheses", "", ["backtracking", "strings", "recursion"]),
    ("Letter Combinations of a Phone Number", "", ["backtracking", "strings", "recursion"]),
    ("Permutations", "", ["backtracking", "arrays", "recursion"]),
    ("Subsets", "", ["backtracking", "arrays", "recursion"]),
    ("Word Search", "", ["backtracking", "matrix", "recursion"]),
    ("Permutation Sequence", "", ["math", "backtracking", "recursion"]),
    # Stack
    ("Min Stack", "", ["stack", "arrays"]),
    ("Simplify Path", "", ["stack", "strings"]),
    # Sorting / Searching
    ("Kth Largest Element in an Array", "", ["arrays", "sorting", "searching"]),
    ("Merge Intervals", "", ["arrays", "sorting"]),
    ("Insert Interval", "", ["arrays", "sorting"]),
    # Hash Map
    ("Implement Trie (Prefix Tree)", "", ["hash-map", "strings", "searching"]),
    # Binary Search
    ("Median of Two Sorted Arrays", "", ["binary-search", "arrays", "math"]),
    ("Search for a Range", "", ["binary-search", "arrays"]),
    ("Search in Rotated Sorted Array", "", ["binary-search", "arrays"]),
    # Queue / Sliding Window
    ("Sliding Window Maximum", "", ["queue", "arrays", "searching"]),
    # Matrix / Stack DP
    ("Maximal Rectangle", "", ["matrix", "stack", "dynamic-programming"]),
    # Math / Bits
    ("Number of 1 Bits", "", ["math", "arrays"]),
    ("Plus One", "", ["arrays", "math"]),
    ("First Missing Positive", "", ["arrays", "hash-map"]),
    # Two Sum fix
    ("Two Sum", "easy", ["arrays", "hash-map"]),
    # Other
    ("Regular Expression Matching", "", ["dynamic-programming", "strings", "recursion"]),
    ("Wildcard Matching", "", ["dynamic-programming", "strings", "recursion"]),
    ("Valid Number", "", ["strings", "simulation"]),
    ("Decode Ways", "", ["dynamic-programming", "strings"]),
]

# ---------------------------------------------------------------------------
# 2. Remove wrong binary-search tags from non-BS problems
# ---------------------------------------------------------------------------

TAG_REMOVALS: list[tuple[str, str]] = [
    # (title, tag_to_remove)
    ("Power of Two", "binary-search"),
    ("Secret Handshake", "binary-search"),
]

# ---------------------------------------------------------------------------
# 3. Add missing constraints to important problems
# ---------------------------------------------------------------------------

CONSTRAINTS_FIXES: list[tuple[str, str]] = [
    ("Two Sum", "2 ≤ nums.length ≤ 10^4\n-10^9 ≤ nums[i] ≤ 10^9\nExactly one solution exists."),
    ("Number of Islands", "m == grid.length; n == grid[i].length\n1 ≤ m, n ≤ 300\ngrid[i][j] is '0' or '1'."),
    ("Merge Intervals", "1 ≤ intervals.length ≤ 10^4\nintervals[i].length == 2\n0 ≤ start_i ≤ end_i ≤ 10^4"),
    ("Insert Interval", "0 ≤ intervals.length ≤ 10^4\nintervals[i].length == 2\n0 ≤ start_i ≤ end_i ≤ 10^5"),
    ("Maximum Subarray", "1 ≤ nums.length ≤ 10^5\n-10^4 ≤ nums[i] ≤ 10^4"),
    ("Climbing Stairs", "1 ≤ n ≤ 45"),
    ("Valid Palindrome", "1 ≤ s.length ≤ 2 × 10^5\ns consists of printable ASCII characters."),
    ("Container With Most Water", "n == height.length\n2 ≤ n ≤ 10^5\n0 ≤ height[i] ≤ 10^4"),
    ("Course Schedule", "1 ≤ numCourses ≤ 2000\n0 ≤ prerequisites.length ≤ 5000\nNo duplicate edges."),
    ("Word Ladder", "1 ≤ beginWord.length ≤ 10\nendWord.length == beginWord.length\nAll words consist of lowercase English letters."),
    ("Search in Rotated Sorted Array", "1 ≤ nums.length ≤ 5000\n-10^4 ≤ nums[i] ≤ 10^4\nAll values are unique. Array was rotated between 1 and n times."),
    ("Longest Substring Without Repeating Characters", "0 ≤ s.length ≤ 5 × 10^4\ns consists of English letters, digits, symbols and spaces."),
    ("Trapping Rain Water", "n == height.length\n1 ≤ n ≤ 2 × 10^4\n0 ≤ height[i] ≤ 10^5"),
    ("Generate Parentheses", "1 ≤ n ≤ 8"),
    ("Permutations", "1 ≤ nums.length ≤ 6\n-10 ≤ nums[i] ≤ 10\nAll integers are unique."),
    ("Combination Sum", "1 ≤ candidates.length ≤ 30\n2 ≤ candidates[i] ≤ 40\n1 ≤ target ≤ 40"),
    ("Word Break", "1 ≤ s.length ≤ 300\n1 ≤ wordDict.length ≤ 1000\n1 ≤ wordDict[i].length ≤ 20"),
    ("Linked List Cycle", "The number of nodes is in the range [0, 10^4].\n-10^5 ≤ Node.val ≤ 10^5"),
    ("Remove Nth Node From End of List", "1 ≤ n ≤ sz (size of list)"),
    ("Sort Colors", "n == nums.length\n1 ≤ n ≤ 300\nnums[i] is 0, 1, or 2."),
    ("Subsets", "1 ≤ nums.length ≤ 10\n-10 ≤ nums[i] ≤ 10\nAll elements are distinct."),
    ("Merge k Sorted Lists", "k == lists.length\n0 ≤ k ≤ 10^4\n0 ≤ lists[i].length ≤ 500"),
    ("Edit Distance", "0 ≤ word1.length, word2.length ≤ 500\nWords consist of lowercase English letters."),
    ("Word Search", "m == board.length; n = board[i].length\n1 ≤ m, n ≤ 6\n1 ≤ word.length ≤ 15"),
    ("Rotate Image", "n == matrix.length == matrix[i].length\n1 ≤ n ≤ 20"),
    ("Set Matrix Zeroes", "m == matrix.length; n == matrix[0].length\n1 ≤ m, n ≤ 200\n-2^31 ≤ matrix[i][j] ≤ 2^31 - 1"),
    ("Product of Array Except Self", "2 ≤ nums.length ≤ 10^5\n-30 ≤ nums[i] ≤ 30"),
    ("3Sum", "3 ≤ nums.length ≤ 3000\n-10^5 ≤ nums[i] ≤ 10^5"),
    ("Jump Game II", "1 ≤ nums.length ≤ 10^4\n0 ≤ nums[i] ≤ 1000"),
    ("Gas Station", "n == gas.length == cost.length\n1 ≤ n ≤ 10^5\n0 ≤ gas[i], cost[i] ≤ 10^4"),
    ("Median of Two Sorted Arrays", "nums1.length == m; nums2.length == n\n0 ≤ m, n ≤ 1000\n-10^6 ≤ nums1[i], nums2[i] ≤ 10^6"),
    ("Maximum Product Subarray", "1 ≤ nums.length ≤ 2 × 10^4\n-10 ≤ nums[i] ≤ 10"),
    ("Palindrome Partitioning", "1 ≤ s.length ≤ 16\ns consists of lowercase English letters."),
    ("Swap Nodes in Pairs", "0 ≤ n ≤ 100 (number of nodes)\n0 ≤ Node.val ≤ 100"),
    ("Kth Largest Element in an Array", "1 ≤ k ≤ nums.length ≤ 10^4\n-10^4 ≤ nums[i] ≤ 10^4"),
    ("Course Schedule", "1 ≤ numCourses ≤ 2000\n0 ≤ prerequisites.length ≤ 5000"),
    ("Sliding Window Maximum", "1 ≤ nums.length ≤ 10^5\n-10^4 ≤ nums[i] ≤ 10^4\n1 ≤ k ≤ nums.length"),
    ("Decode Ways", "1 ≤ s.length ≤ 100\ns consists of digits only."),
    ("Letter Combinations of a Phone Number", "0 ≤ digits.length ≤ 4\ndigits[i] is a digit in ['2','9']."),
    ("Restore IP Addresses", "1 ≤ s.length ≤ 20\ns consists of digits only."),
    ("Kth Smallest Element in a BST", "1 ≤ k ≤ n ≤ 10^4\n0 ≤ Node.val ≤ 10^4"),
    ("Reorder List", "The number of nodes is in the range [1, 5 × 10^4].\n1 ≤ Node.val ≤ 1000"),
    ("Binary Tree Zigzag Level Order Traversal", "0 ≤ number of nodes ≤ 2000\n-100 ≤ Node.val ≤ 100"),
    ("Construct Binary Tree from Inorder and Postorder Traversal", "1 ≤ inorder.length ≤ 3000\nAll values are unique."),
    ("Validate Binary Search Tree", "The number of nodes is in the range [1, 10^4].\n-2^31 ≤ Node.val ≤ 2^31 - 1"),
    ("Unique Binary Search Trees II", "1 ≤ n ≤ 8"),
    ("Distinct Subsequences", "1 ≤ s.length, t.length ≤ 1000\ns and t consist of lowercase English letters."),
    ("Interleaving String", "0 ≤ s1.length, s2.length ≤ 100"),
    ("Scramble String", "1 ≤ s1.length ≤ 30\ns1.length == s2.length"),
    ("Minimum Path Sum", "m == grid.length; n == grid[0].length\n1 ≤ m, n ≤ 200\n0 ≤ grid[i][j] ≤ 200"),
    ("Best Time to Buy and Sell Stock III", "1 ≤ prices.length ≤ 10^5\n0 ≤ prices[i] ≤ 10^5"),
    ("Longest Palindromic Substring", "1 ≤ s.length ≤ 1000\ns consists of digits and English letters."),
    ("Longest Valid Parentheses", "0 ≤ s.length ≤ 3 × 10^4\ns[i] is '(' or ')'"),
    ("Add Binary", "1 ≤ a.length, b.length ≤ 10^4\nStrings consist of '0' and '1' only."),
    ("ZigZag Conversion", "1 ≤ s.length ≤ 1000\n1 ≤ numRows ≤ 1000"),
    ("Reverse Nodes in k-Group", "k is a positive integer ≤ length of the list.\n1 ≤ k ≤ 100"),
    ("Maximal Rectangle", "rows == matrix.length; cols == matrix[0].length\n1 ≤ rows, cols ≤ 200"),
    ("Surrounded Regions", "m == board.length; n == board[0].length\n1 ≤ m, n ≤ 200\nboard[i][j] is 'X' or 'O'"),
    ("Plus One", "1 ≤ digits.length ≤ 100\n0 ≤ digits[i] ≤ 9"),
    ("Number of 1 Bits", "The input is a 32-bit unsigned integer."),
    ("First Missing Positive", "1 ≤ nums.length ≤ 10^5\n-2^31 ≤ nums[i] ≤ 2^31 - 1"),
    ("Remove Duplicates from Sorted Array", "1 ≤ nums.length ≤ 3 × 10^4\n-100 ≤ nums[i] ≤ 100"),
    ("Search for a Range", "0 ≤ nums.length ≤ 10^5\n-10^9 ≤ nums[i] ≤ 10^9"),
    ("Next Permutation", "1 ≤ nums.length ≤ 100\n0 ≤ nums[i] ≤ 100"),
    ("Missing Ranges", "-10^9 ≤ lower ≤ upper ≤ 10^9"),
    ("Count and Say", "1 ≤ n ≤ 30"),
    ("Palindrome Linked List", "1 ≤ n ≤ 10^5\n0 ≤ Node.val ≤ 9"),
    ("Partition List", "0 ≤ n ≤ 200; Node.val in [1..200]; x in [1..201]"),
    ("Rotate List", "0 ≤ n ≤ 500; −100 ≤ Node.val ≤ 100; 0 ≤ k ≤ 2×10^9"),
    ("Reverse Linked List II", "1 ≤ m ≤ n ≤ length of list; list length ≤ 500"),
    ("Same Tree", "0 ≤ number of nodes ≤ 100\n-10^4 ≤ Node.val ≤ 10^4"),
    ("Symmetric Tree", "0 ≤ number of nodes ≤ 1000\n-100 ≤ Node.val ≤ 100"),
    ("Path Sum", "0 ≤ number of nodes ≤ 5000\n-1000 ≤ Node.val ≤ 1000"),
    ("Populating Next Right Pointers in Each Node", "0 ≤ number of nodes ≤ 2048\n-1000 ≤ Node.val ≤ 1000"),
    ("Decode Ways", "1 ≤ s.length ≤ 100\ndigits only, no leading zeros except '0' itself"),
    ("Word Break", "1 ≤ s.length ≤ 300\nAll strings consist of lowercase English letters."),
    ("Implement Trie (Prefix Tree)", "1 ≤ word.length ≤ 2000\nword and prefix consist only of lowercase English letters."),
    ("Min Stack", "At most 3 × 10^4 operations.\nPop, top, and getMin are always called on a non-empty stack."),
    ("Simplify Path", "1 ≤ path.length ≤ 3000\npath starts with '/'."),
    ("Insertion Sort List", "0 ≤ number of nodes ≤ 5000\n-5000 ≤ Node.val ≤ 5000"),
    ("4Sum", "1 ≤ nums.length ≤ 200\n-10^9 ≤ nums[i] ≤ 10^9"),
    ("3Sum Closest", "3 ≤ nums.length ≤ 500\n-10^3 ≤ nums[i] ≤ 10^3"),
    ("Permutation Sequence", "1 ≤ n ≤ 9\n1 ≤ k ≤ n!"),
    ("Unique Paths II", "m == obstacleGrid.length; n == obstacleGrid[0].length\n1 ≤ m, n ≤ 100\nobstacleGrid[i][j] is 0 or 1."),
    ("Maximum Product Subarray", "1 ≤ nums.length ≤ 2 × 10^4\n-10 ≤ nums[i] ≤ 10"),
    ("Distinct Subsequences", "1 ≤ s.length ≤ 1000; 1 ≤ t.length ≤ 1000"),
    ("Scramble String", "1 ≤ s1.length ≤ 30; s1.length == s2.length"),
    ("Wildcard Matching", "0 ≤ s.length, p.length ≤ 2000\np may contain '?' and '*'"),
    ("Regular Expression Matching", "1 ≤ s.length ≤ 20; 1 ≤ p.length ≤ 30\nPattern characters: a-z, '.', '*'"),
    ("Best Time to Buy and Sell Stock III", "1 ≤ prices.length ≤ 10^5\n0 ≤ prices[i] ≤ 10^5"),
    ("Valid Number", "1 ≤ s.length ≤ 20\nConsist of printable ASCII characters."),
    ("Moving Stones Until Consecutive", "1 ≤ a < b < c ≤ 100"),
    ("ZigZag Conversion", "1 ≤ s.length ≤ 1000; 1 ≤ numRows ≤ 1000"),
]

# ---------------------------------------------------------------------------
# 4. New problems to add (for thin learning paths)
# ---------------------------------------------------------------------------

NEW_PROBLEMS: list[dict] = [
    # ---- SETS (need ~7 more easy/medium) ----
    {
        "title": "Set Intersection",
        "slug": "set-intersection",
        "description": "Given two lists of integers, return a sorted list of elements that appear in both lists. Each element in the result must be unique.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "arrays"],
        "examples": [
            {"input": "[1, 2, 3, 4]\n[2, 4, 6]", "output": "[2, 4]", "explanation": "2 and 4 appear in both lists."},
            {"input": "[1, 1, 2, 3]\n[1, 3, 5]", "output": "[1, 3]", "explanation": "Duplicates are collapsed; 1 and 3 are shared."},
        ],
        "constraints": "0 ≤ len(a), len(b) ≤ 10^4\n-10^9 ≤ element ≤ 10^9",
        "hints": ["Convert each list to a set, then use the & operator.", "sorted() on a set gives you a sorted list."],
        "sort_order": 3001,
        "source": "curated",
    },
    {
        "title": "Set Union",
        "slug": "set-union",
        "description": "Given two lists of integers, return a sorted list of all elements that appear in at least one of the lists. The result must contain no duplicates.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "arrays"],
        "examples": [
            {"input": "[1, 2, 3]\n[2, 3, 4, 5]", "output": "[1, 2, 3, 4, 5]", "explanation": "All unique values from both lists, sorted."},
            {"input": "[1, 1, 2]\n[2, 3]", "output": "[1, 2, 3]", "explanation": "Duplicates are removed."},
        ],
        "constraints": "0 ≤ len(a), len(b) ≤ 10^4\n-10^9 ≤ element ≤ 10^9",
        "hints": ["Use the | operator on two sets.", "Alternatively, set(a) | set(b)."],
        "sort_order": 3002,
        "source": "curated",
    },
    {
        "title": "Set Difference",
        "slug": "set-difference",
        "description": "Given two lists `a` and `b`, return a sorted list of elements that are in `a` but NOT in `b`. Each result element must appear only once.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "arrays"],
        "examples": [
            {"input": "a=[1, 2, 3, 4]\nb=[2, 4]", "output": "[1, 3]", "explanation": "1 and 3 are in a but not in b."},
            {"input": "a=[5, 5, 6, 7]\nb=[5]", "output": "[6, 7]", "explanation": "5 is excluded; duplicates are collapsed."},
        ],
        "constraints": "0 ≤ len(a), len(b) ≤ 10^4\n-10^9 ≤ element ≤ 10^9",
        "hints": ["Use set(a) - set(b).", "Sort the result before returning."],
        "sort_order": 3003,
        "source": "curated",
    },
    {
        "title": "Symmetric Difference",
        "slug": "symmetric-difference",
        "description": "Given two lists `a` and `b`, return a sorted list of elements that are in exactly one of the two lists (but not both).",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "arrays"],
        "examples": [
            {"input": "a=[1, 2, 3]\nb=[2, 3, 4]", "output": "[1, 4]", "explanation": "1 is only in a; 4 is only in b; 2 and 3 are in both."},
            {"input": "a=[1, 2]\nb=[1, 2]", "output": "[]", "explanation": "All elements are shared; symmetric difference is empty."},
        ],
        "constraints": "0 ≤ len(a), len(b) ≤ 10^4\n-10^9 ≤ element ≤ 10^9",
        "hints": ["Use set(a) ^ set(b).", "This is equivalent to (a | b) - (a & b)."],
        "sort_order": 3004,
        "source": "curated",
    },
    {
        "title": "Unique Characters in String",
        "slug": "unique-chars-string",
        "description": "Given a string, return a sorted list of all unique characters that appear in it. The order of the output must be lexicographic (standard alphabetical/ASCII order).",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "strings"],
        "examples": [
            {"input": "\"hello\"", "output": "['e', 'h', 'l', 'o']", "explanation": "'l' appears twice but is listed only once, and the result is sorted."},
            {"input": "\"abcabc\"", "output": "['a', 'b', 'c']", "explanation": "Three unique characters, sorted lexicographically."},
        ],
        "constraints": "0 ≤ len(s) ≤ 10^5\ns consists of printable ASCII characters.",
        "hints": ["Converting a string to a set gives its unique characters.", "sorted() on a set returns a sorted list."],
        "sort_order": 3005,
        "source": "curated",
    },
    {
        "title": "Common Elements Across Multiple Lists",
        "slug": "common-elements-n-lists",
        "description": "Given a list of lists, return a sorted list of integers that appear in ALL of the sublists. If the input is empty, return an empty list.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["sets", "arrays"],
        "examples": [
            {"input": "[[1, 2, 3], [2, 3, 4], [2, 5, 3]]", "output": "[2, 3]", "explanation": "2 and 3 appear in all three sublists."},
            {"input": "[[1, 2], [3, 4]]", "output": "[]", "explanation": "No element is common to both lists."},
        ],
        "constraints": "0 ≤ len(lists) ≤ 1000\n0 ≤ len(lists[i]) ≤ 1000\n-10^9 ≤ element ≤ 10^9",
        "hints": ["Start with the intersection of the first two lists, then intersect with each remaining list.", "functools.reduce with set.intersection works cleanly."],
        "sort_order": 3006,
        "source": "curated",
    },
    {
        "title": "Anagram Check",
        "slug": "anagram-check",
        "description": "Two strings are anagrams if one can be rearranged to form the other. Given two strings, return `True` if they are anagrams, `False` otherwise. Case-insensitive; ignore spaces.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "strings", "hash-map"],
        "examples": [
            {"input": "s1=\"listen\"\ns2=\"silent\"", "output": "True", "explanation": "'listen' and 'silent' contain the same letters."},
            {"input": "s1=\"hello\"\ns2=\"world\"", "output": "False", "explanation": "Different letters."},
            {"input": "s1=\"Astronomer\"\ns2=\"Moon starer\"", "output": "True", "explanation": "After lowercasing and removing spaces, both have the same characters."},
        ],
        "constraints": "0 ≤ len(s1), len(s2) ≤ 10^4\nStrings may contain uppercase letters and spaces.",
        "hints": ["Normalize both strings: lowercase, remove spaces.", "Comparing sorted versions of two strings tells you if they are anagrams."],
        "sort_order": 3007,
        "source": "curated",
    },
    {
        "title": "Missing Letters",
        "slug": "missing-letters",
        "description": "Given a string of lowercase letters, find all letters of the English alphabet that are NOT present in the string. Return them as a sorted list. If all 26 letters are present, return an empty list.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "strings"],
        "examples": [
            {"input": "\"the quick brown fox\"", "output": "['a', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 'u', 'v', 'w', 'x', 'y', 'z']", "explanation": "Only letters in the phrase are present; all others are missing."},
            {"input": "\"abcdefghijklmnopqrstuvwxyz\"", "output": "[]", "explanation": "All 26 letters are present."},
        ],
        "constraints": "0 ≤ len(s) ≤ 10^5\ns consists of lowercase letters and spaces.",
        "hints": ["Build a set of letters in the alphabet, then subtract the set of letters in the string.", "set(string.ascii_lowercase) - set(s.lower().replace(' ', ''))"],
        "sort_order": 3008,
        "source": "curated",
    },
    {
        "title": "Deduplicate While Preserving Order",
        "slug": "dedup-preserve-order",
        "description": "Given a list of integers, return a new list with duplicates removed while preserving the original order of first occurrences.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "arrays"],
        "examples": [
            {"input": "[3, 1, 4, 1, 5, 9, 2, 6, 5, 3]", "output": "[3, 1, 4, 5, 9, 2, 6]", "explanation": "Each element keeps its first position; duplicates are discarded."},
            {"input": "[1, 2, 3]", "output": "[1, 2, 3]", "explanation": "No duplicates — output equals input."},
        ],
        "constraints": "0 ≤ len(nums) ≤ 10^5\n-10^9 ≤ nums[i] ≤ 10^9",
        "hints": ["Use a set to track which values you've seen so far.", "Iterate once; append to result only if the value isn't in the 'seen' set."],
        "sort_order": 3009,
        "source": "curated",
    },
    {
        "title": "Two Lists No Overlap",
        "slug": "two-lists-no-overlap",
        "description": "Given two lists of integers, return `True` if the lists share no common elements (i.e., their intersection is empty), `False` otherwise.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sets", "arrays"],
        "examples": [
            {"input": "a=[1, 2, 3]\nb=[4, 5, 6]", "output": "True", "explanation": "No element appears in both lists."},
            {"input": "a=[1, 2, 3]\nb=[3, 4, 5]", "output": "False", "explanation": "3 appears in both lists."},
        ],
        "constraints": "0 ≤ len(a), len(b) ≤ 10^5\n-10^9 ≤ element ≤ 10^9",
        "hints": ["set(a).isdisjoint(set(b)) returns True if they share no elements.", "This is O(n + m) — much faster than nested loops."],
        "sort_order": 3010,
        "source": "curated",
    },
    # ---- QUEUES (need ~6 more easy/medium) ----
    {
        "title": "Queue Implementation",
        "slug": "queue-implementation",
        "description": "Implement a `Queue` class using a Python list. It must support:\n- `enqueue(val)` — add an element to the back\n- `dequeue()` — remove and return the front element; raise `IndexError` if empty\n- `peek()` — return the front element without removing it; raise `IndexError` if empty\n- `is_empty()` — return `True` if the queue has no elements\n- `size()` — return the number of elements",
        "difficulty": "easy",
        "language": "python",
        "topic": ["queue", "arrays"],
        "examples": [
            {"input": "q = Queue()\nq.enqueue(1)\nq.enqueue(2)\nprint(q.dequeue())\nprint(q.peek())\nprint(q.size())", "output": "1\n2\n1", "explanation": "enqueue 1 and 2; dequeue returns 1 (front); peek shows 2; size is 1."},
        ],
        "constraints": "At most 10^4 operations.\nValues can be any integer.",
        "hints": ["Use collections.deque for O(1) append and popleft.", "Alternatively, use a list with append() and pop(0) — but this is O(n) for dequeue."],
        "sort_order": 3011,
        "source": "curated",
    },
    {
        "title": "Number of Recent Calls",
        "slug": "number-recent-calls",
        "description": "Implement a `RecentCounter` class that counts recent requests within a 3000-millisecond window:\n- `ping(t)` — adds a new request at time `t` (milliseconds) and returns the number of requests that occurred in `[t - 3000, t]`.\nYou may assume `t` is strictly increasing.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["queue", "arrays"],
        "examples": [
            {"input": "rc = RecentCounter()\nprint(rc.ping(1))\nprint(rc.ping(100))\nprint(rc.ping(3001))\nprint(rc.ping(3002))", "output": "1\n2\n3\n3", "explanation": "ping(3002): window is [2, 3002], which includes 100, 3001, 3002."},
        ],
        "constraints": "1 ≤ t ≤ 10^9\nt is strictly increasing across calls.\nAt most 10^4 calls to ping.",
        "hints": ["Use a deque. On each ping, add t then remove all entries < t - 3000.", "The length of the deque is the answer."],
        "sort_order": 3012,
        "source": "curated",
    },
    {
        "title": "First Non-Repeating Character in Stream",
        "slug": "first-non-repeating-stream",
        "description": "Given a stream of characters, return the first non-repeating character at each step. After reading each character, append the first non-repeating character to the result. If no such character exists, append `'#'`.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["queue", "strings", "hash-map"],
        "examples": [
            {"input": "stream = \"aabcbc\"", "output": "\"a#bbcc\"", "explanation": "a→'a'; aa→'#'; aab→'b'; aabc→'b'; aabcb→'c'; aabcbc→'c'."},
            {"input": "stream = \"abab\"", "output": "\"aabb\"", "explanation": "a→'a'; ab→'a'; aba→'b'; abab→'b' (wait — 'b' is still first non-repeating at step 4 since 'a' repeated first)."},
        ],
        "constraints": "1 ≤ len(stream) ≤ 10^5\nstream consists of lowercase English letters.",
        "hints": ["Maintain a queue of candidates and a frequency map.", "After each character, pop from the front of the queue while the front character has frequency > 1."],
        "sort_order": 3013,
        "source": "curated",
    },
    {
        "title": "Implement Stack Using Two Queues",
        "slug": "stack-using-two-queues",
        "description": "Implement a stack (LIFO) using only two queues. The stack must support:\n- `push(val)` — push element onto the stack\n- `pop()` — remove and return the top element\n- `top()` — return the top element without removing it\n- `empty()` — return `True` if the stack is empty",
        "difficulty": "medium",
        "language": "python",
        "topic": ["queue", "stack", "arrays"],
        "examples": [
            {"input": "s = Stack()\ns.push(1)\ns.push(2)\nprint(s.top())\nprint(s.pop())\nprint(s.empty())", "output": "2\n2\nFalse", "explanation": "After pushing 1 and 2, top is 2. pop returns 2, leaving 1. empty is False."},
        ],
        "constraints": "1 ≤ val ≤ 9\nAt most 100 calls per operation.\npop and top are always called on a non-empty stack.",
        "hints": ["On each push, move all elements from q1 to q2, add the new element to q1, then swap q1 and q2.", "This makes push O(n) but pop O(1)."],
        "sort_order": 3014,
        "source": "curated",
    },
    {
        "title": "Design Hit Counter",
        "slug": "design-hit-counter",
        "description": "Design a hit counter that counts the number of hits in the past 5 minutes (300 seconds).\n- `hit(timestamp)` — records a hit at the given timestamp (in seconds).\n- `getHits(timestamp)` — returns the number of hits in the interval `[timestamp - 299, timestamp]`.\nTimestamps are provided in non-decreasing order.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["queue", "arrays"],
        "examples": [
            {"input": "counter = HitCounter()\ncounter.hit(1)\ncounter.hit(2)\ncounter.hit(3)\nprint(counter.getHits(4))\ncounter.hit(300)\nprint(counter.getHits(300))\nprint(counter.getHits(301))", "output": "3\n4\n3", "explanation": "At t=4: hits at 1,2,3. At t=300: hits at 1,2,3,300. At t=301: hit at 1 is outside window [2,301]; 3 hits remain."},
        ],
        "constraints": "1 ≤ timestamp ≤ 2 × 10^9\nAll calls to hit and getHits use increasing timestamps.\nAt most 300 calls per second.",
        "hints": ["Use a deque storing (timestamp, count) pairs.", "On getHits, remove all entries with timestamp ≤ current - 300."],
        "sort_order": 3015,
        "source": "curated",
    },
    {
        "title": "BFS Level Order Traversal",
        "slug": "bfs-level-order-traversal",
        "description": "Given a binary tree where each node holds an integer value, perform a level-order (BFS) traversal and return a list of lists — each inner list contains the values at that level from left to right.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["queue", "binary-tree", "arrays"],
        "examples": [
            {"input": "root = [3, 9, 20, None, None, 15, 7]", "output": "[[3], [9, 20], [15, 7]]", "explanation": "Level 0: [3]; Level 1: [9, 20]; Level 2: [15, 7]."},
            {"input": "root = [1]", "output": "[[1]]", "explanation": "Single node — one level."},
            {"input": "root = []", "output": "[]", "explanation": "Empty tree."},
        ],
        "constraints": "0 ≤ number of nodes ≤ 2000\n-1000 ≤ Node.val ≤ 1000",
        "hints": ["Use collections.deque. Add the root. Then loop: record the current level size, dequeue that many nodes, and enqueue their children.", "Each iteration of the outer loop processes one level."],
        "sort_order": 3016,
        "source": "curated",
    },
    {
        "title": "Task Scheduler",
        "slug": "task-scheduler",
        "description": "Given a list of CPU tasks (capital letters A–Z) and a non-negative cooling interval `n`, return the minimum number of CPU intervals needed to execute all tasks. Tasks can be done in any order. After executing a task, the CPU must wait `n` intervals before executing the same task again. The CPU can be idle during waiting periods.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["queue", "hash-map", "greedy"],
        "examples": [
            {"input": "tasks=['A','A','A','B','B','B'], n=2", "output": "8", "explanation": "A → B → idle → A → B → idle → A → B. Total: 8 intervals."},
            {"input": "tasks=['A','A','A','B','B','B'], n=0", "output": "6", "explanation": "No cooldown; tasks can be done back-to-back."},
        ],
        "constraints": "1 ≤ tasks.length ≤ 10^4\ntasks[i] is an uppercase letter.\n0 ≤ n ≤ 100",
        "hints": ["Count the frequency of each task.", "The minimum intervals is max(len(tasks), (max_freq - 1) * (n + 1) + count_of_tasks_with_max_freq)."],
        "sort_order": 3017,
        "source": "curated",
    },
    # ---- BINARY SEARCH (need ~5 more medium/hard) ----
    {
        "title": "Search Insert Position",
        "slug": "search-insert-position",
        "description": "Given a sorted array of distinct integers and a target value, return the index where the target is found, or the index where it would be inserted to keep the array sorted.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["binary-search", "arrays"],
        "examples": [
            {"input": "nums=[1,3,5,6], target=5", "output": "2", "explanation": "5 is at index 2."},
            {"input": "nums=[1,3,5,6], target=2", "output": "1", "explanation": "2 would be inserted between 1 and 3, at index 1."},
            {"input": "nums=[1,3,5,6], target=7", "output": "4", "explanation": "7 is larger than all elements; it would go at the end."},
        ],
        "constraints": "1 ≤ nums.length ≤ 10^4\n-10^4 ≤ nums[i] ≤ 10^4\nnums contains distinct values sorted in ascending order.",
        "hints": ["Classic binary search: lo=0, hi=len(nums). When lo==hi you've found the insert position.", "bisect.bisect_left does exactly this."],
        "sort_order": 3020,
        "source": "curated",
    },
    {
        "title": "Find Peak Element",
        "slug": "find-peak-element",
        "description": "A peak element is an element strictly greater than its neighbors. Given an array `nums`, find a peak element and return its index. If the array contains multiple peaks, return the index of any peak. Treat elements outside the array as negative infinity.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["binary-search", "arrays"],
        "examples": [
            {"input": "nums=[1,2,3,1]", "output": "2", "explanation": "nums[2]=3 > nums[1]=2 and nums[3]=1."},
            {"input": "nums=[1,2,1,3,5,6,4]", "output": "5", "explanation": "nums[5]=6 is a peak (index 1 with value 2 is also a peak)."},
        ],
        "constraints": "1 ≤ nums.length ≤ 1000\n-2^31 ≤ nums[i] ≤ 2^31 - 1\nnums[i] != nums[i+1] for all valid i.",
        "hints": ["Binary search: if nums[mid] < nums[mid+1], the peak must be to the right.", "If nums[mid] > nums[mid+1], the peak is at mid or to the left."],
        "sort_order": 3021,
        "source": "curated",
    },
    {
        "title": "Find First and Last Position",
        "slug": "find-first-last-position",
        "description": "Given a sorted array of integers (possibly with duplicates) and a target value, return the starting and ending position of the target in the array as `[start, end]`. If the target is not found, return `[-1, -1]`. Your algorithm must run in O(log n) time.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["binary-search", "arrays"],
        "examples": [
            {"input": "nums=[5,7,7,8,8,10], target=8", "output": "[3, 4]", "explanation": "8 first appears at index 3 and last at index 4."},
            {"input": "nums=[5,7,7,8,8,10], target=6", "output": "[-1, -1]", "explanation": "6 is not in the array."},
            {"input": "nums=[], target=0", "output": "[-1, -1]", "explanation": "Empty array — target not found."},
        ],
        "constraints": "0 ≤ nums.length ≤ 10^5\n-10^9 ≤ nums[i] ≤ 10^9\nnums is non-decreasing.",
        "hints": ["Run binary search twice: once to find the leftmost occurrence, once for the rightmost.", "bisect_left and bisect_right from the bisect module handle this directly."],
        "sort_order": 3022,
        "source": "curated",
    },
    {
        "title": "Koko Eating Bananas",
        "slug": "koko-eating-bananas",
        "description": "Koko loves bananas. There are `n` piles of bananas. The i-th pile has `piles[i]` bananas. Koko can eat at most `k` bananas per hour. Each hour she chooses a pile and eats up to `k` bananas from it (she doesn't switch piles mid-hour). Return the minimum integer `k` such that she can eat all bananas within `h` hours.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["binary-search", "arrays"],
        "examples": [
            {"input": "piles=[3,6,7,11], h=8", "output": "4", "explanation": "Eating at speed 4: ceil(3/4)+ceil(6/4)+ceil(7/4)+ceil(11/4)=1+2+2+3=8."},
            {"input": "piles=[30,11,23,4,20], h=5", "output": "30", "explanation": "She must eat the largest pile in one hour; speed 30 is required."},
        ],
        "constraints": "1 ≤ piles.length ≤ 10^4\npiles.length ≤ h ≤ 10^9\n1 ≤ piles[i] ≤ 10^9",
        "hints": ["Binary search on the answer: lo=1, hi=max(piles).", "For a given k, compute total hours needed with sum(ceil(p/k) for p in piles). If hours <= h, k might be too large — try smaller."],
        "sort_order": 3023,
        "source": "curated",
    },
    {
        "title": "Minimum in Rotated Sorted Array",
        "slug": "minimum-rotated-sorted-array",
        "description": "Suppose an array of unique integers was sorted in ascending order and then rotated between 1 and n times. Given the rotated array, return the minimum element. Your algorithm must run in O(log n) time.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["binary-search", "arrays"],
        "examples": [
            {"input": "nums=[3,4,5,1,2]", "output": "1", "explanation": "The original array [1,2,3,4,5] was rotated 3 times."},
            {"input": "nums=[4,5,6,7,0,1,2]", "output": "0", "explanation": "The minimum is 0."},
            {"input": "nums=[11,13,15,17]", "output": "11", "explanation": "No rotation — minimum is first element."},
        ],
        "constraints": "n == nums.length\n1 ≤ n ≤ 5000\n-5000 ≤ nums[i] ≤ 5000\nAll integers are unique.",
        "hints": ["Binary search: if nums[mid] > nums[hi], the minimum is in the right half.", "If nums[mid] ≤ nums[hi], the minimum is in the left half (including mid)."],
        "sort_order": 3024,
        "source": "curated",
    },
    {
        "title": "Count Negative Numbers in Sorted Matrix",
        "slug": "count-negatives-sorted-matrix",
        "description": "Given an m × n matrix where each row and each column is sorted in non-increasing order, return the number of negative numbers in the matrix.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["binary-search", "matrix", "arrays"],
        "examples": [
            {"input": "grid=[[4,3,2,-1],[3,2,1,-1],[1,1,-1,-2],[-1,-1,-2,-3]]", "output": "8", "explanation": "There are 8 negative numbers in the matrix."},
            {"input": "grid=[[3,2],[1,0]]", "output": "0", "explanation": "No negative numbers."},
        ],
        "constraints": "m == grid.length; n == grid[i].length\n1 ≤ m, n ≤ 100\n-100 ≤ grid[i][j] ≤ 100\nEach row and column is sorted in non-increasing order.",
        "hints": ["For each row, use binary search to find the first negative number.", "All elements to the right of that position in the row are also negative."],
        "sort_order": 3025,
        "source": "curated",
    },
    # ---- LINKED LISTS (need ~5 more medium) ----
    {
        "title": "Reverse Linked List",
        "slug": "reverse-linked-list",
        "description": "Given the head of a singly linked list, reverse the list and return the new head.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["linked-list", "recursion"],
        "examples": [
            {"input": "head = [1, 2, 3, 4, 5]", "output": "[5, 4, 3, 2, 1]", "explanation": "The list is reversed."},
            {"input": "head = [1, 2]", "output": "[2, 1]", "explanation": "Two-element list reversed."},
            {"input": "head = []", "output": "[]", "explanation": "Empty list stays empty."},
        ],
        "constraints": "0 ≤ number of nodes ≤ 5000\n-5000 ≤ Node.val ≤ 5000",
        "hints": ["Iterative: keep track of prev, curr, and next.", "Recursive: reverse(head.next) then make head.next.next = head and head.next = None."],
        "sort_order": 3030,
        "source": "curated",
    },
    {
        "title": "Detect Cycle in Linked List",
        "slug": "detect-linked-list-cycle",
        "description": "Given the head of a linked list, determine if the list contains a cycle. A cycle exists if some node can be reached again by following `next` pointers. Return `True` if a cycle exists, `False` otherwise.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["linked-list", "two-pointers"],
        "examples": [
            {"input": "head = [3, 2, 0, -4] with tail -> index 1", "output": "True", "explanation": "The tail connects back to node at index 1, forming a cycle."},
            {"input": "head = [1, 2] with tail -> index 0", "output": "True", "explanation": "A cycle exists."},
            {"input": "head = [1]", "output": "False", "explanation": "Single node, no cycle."},
        ],
        "constraints": "0 ≤ number of nodes ≤ 10^4\n-10^5 ≤ Node.val ≤ 10^5",
        "hints": ["Floyd's Tortoise and Hare: use a slow pointer (moves 1 step) and a fast pointer (moves 2 steps). If they ever meet, there's a cycle.", "Alternatively, use a hash set to track visited nodes."],
        "sort_order": 3031,
        "source": "curated",
    },
    {
        "title": "Merge Two Sorted Linked Lists",
        "slug": "merge-two-sorted-linked-lists",
        "description": "Given the heads of two sorted linked lists, merge them into a single sorted linked list and return the head of the merged list.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["linked-list", "recursion"],
        "examples": [
            {"input": "list1 = [1, 2, 4]\nlist2 = [1, 3, 4]", "output": "[1, 1, 2, 3, 4, 4]", "explanation": "Both lists are merged in sorted order."},
            {"input": "list1 = []\nlist2 = []", "output": "[]", "explanation": "Two empty lists merge to an empty list."},
            {"input": "list1 = []\nlist2 = [0]", "output": "[0]", "explanation": "Empty list merged with non-empty."},
        ],
        "constraints": "0 ≤ n, m ≤ 50 (lengths of the two lists)\n-100 ≤ Node.val ≤ 100",
        "hints": ["Use a dummy head node to simplify the merge logic.", "Recursive approach: compare heads, recurse on the smaller one."],
        "sort_order": 3032,
        "source": "curated",
    },
    {
        "title": "Find Middle of Linked List",
        "slug": "find-middle-linked-list",
        "description": "Given the head of a singly linked list, return the middle node. If the list has two middle nodes (even length), return the second middle node.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["linked-list", "two-pointers"],
        "examples": [
            {"input": "head = [1, 2, 3, 4, 5]", "output": "node with value 3", "explanation": "Middle node is 3."},
            {"input": "head = [1, 2, 3, 4, 5, 6]", "output": "node with value 4", "explanation": "Two middle nodes (3 and 4); return the second one."},
        ],
        "constraints": "1 ≤ number of nodes ≤ 100\n1 ≤ Node.val ≤ 100",
        "hints": ["Fast and slow pointer: slow moves 1 step, fast moves 2 steps. When fast reaches the end, slow is at the middle.", "This is a classic two-pointer technique."],
        "sort_order": 3033,
        "source": "curated",
    },
    {
        "title": "Remove Duplicates from Sorted Linked List",
        "slug": "remove-duplicates-sorted-linked-list",
        "description": "Given the head of a sorted linked list, delete all duplicate nodes so that each value appears only once. Return the head of the cleaned-up list.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["linked-list"],
        "examples": [
            {"input": "head = [1, 1, 2]", "output": "[1, 2]", "explanation": "The duplicate 1 is removed."},
            {"input": "head = [1, 1, 2, 3, 3]", "output": "[1, 2, 3]", "explanation": "Both duplicate 1s and 3s are removed."},
        ],
        "constraints": "0 ≤ number of nodes ≤ 300\n-100 ≤ Node.val ≤ 100\nThe list is sorted in ascending order.",
        "hints": ["Traverse the list. While node.next has the same value as node, skip it by setting node.next = node.next.next.", "Continue until node.next is None or has a different value."],
        "sort_order": 3034,
        "source": "curated",
    },
    {
        "title": "Flatten Multilevel Doubly Linked List",
        "slug": "flatten-multilevel-doubly-linked-list",
        "description": "A doubly linked list node has `val`, `prev`, `next`, and a `child` pointer. The `child` may point to a separate doubly linked list. Flatten the list so that all nodes appear in a single-level doubly linked list by inserting each child list directly after its parent node.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["linked-list", "stack", "recursion"],
        "examples": [
            {"input": "1 <-> 2 <-> 3 <-> 4 <-> 5 <-> 6\n        |              |\n        7 <-> 8 <-> 9  10 <-> 11 <-> 12\n              |\n              11 <-> 12", "output": "[1, 2, 3, 7, 8, 11, 12, 9, 4, 5, 6]", "explanation": "Child lists are inserted after their parent."},
        ],
        "constraints": "The number of nodes is in [0, 1000].\n1 ≤ Node.val ≤ 10^5",
        "hints": ["Use a stack. When you encounter a node with a child, push node.next onto the stack and continue with the child.", "Alternatively, recurse: flatten the child, attach it after the parent, then reattach the rest."],
        "sort_order": 3035,
        "source": "curated",
    },
    # ---- BACKTRACKING (need ~3 more medium) ----
    {
        "title": "N-Queens",
        "slug": "n-queens",
        "description": "Place `n` non-attacking queens on an n×n chessboard. Return all distinct solutions, where each solution is represented as a list of strings — each string is a row of the board, with `'Q'` for a queen and `'.'` for an empty cell.",
        "difficulty": "hard",
        "language": "python",
        "topic": ["backtracking", "arrays", "recursion"],
        "examples": [
            {"input": "n=4", "output": "[[\".Q..\",\"...Q\",\"Q...\",\"..Q.\"],  [\"..Q.\",\"Q...\",\"...Q\",\".Q..\"]]", "explanation": "Two distinct solutions for n=4."},
            {"input": "n=1", "output": "[[\"Q\"]]", "explanation": "Only one solution for a 1×1 board."},
        ],
        "constraints": "1 ≤ n ≤ 9",
        "hints": ["Backtrack row by row. For each row, try placing a queen in each column.", "Track which columns and diagonals (both directions) are under attack using sets.", "A queen at (r, c) attacks diagonals r-c (top-left to bottom-right) and r+c (top-right to bottom-left)."],
        "sort_order": 3040,
        "source": "curated",
    },
    {
        "title": "Combination Sum II",
        "slug": "combination-sum-ii",
        "description": "Given a collection of candidate numbers (may contain duplicates) and a target, find all unique combinations that sum to the target. Each number may only be used once in a combination.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["backtracking", "arrays"],
        "examples": [
            {"input": "candidates=[10,1,2,7,6,1,5], target=8", "output": "[[1,1,6],[1,2,5],[1,7],[2,6]]", "explanation": "Four unique combinations that sum to 8."},
            {"input": "candidates=[2,5,2,1,2], target=5", "output": "[[1,2,2],[5]]", "explanation": "Two unique combinations."},
        ],
        "constraints": "1 ≤ candidates.length ≤ 100\n1 ≤ candidates[i] ≤ 50\n1 ≤ target ≤ 30",
        "hints": ["Sort the candidates first. Skip duplicate values at the same recursion depth to avoid duplicate combinations.", "Use a 'start' index to prevent reusing the same element."],
        "sort_order": 3041,
        "source": "curated",
    },
    {
        "title": "Phone Number Letter Combinations",
        "slug": "phone-number-letter-combinations",
        "description": "Given a string of digits from 2 to 9, return all possible letter combinations the digits could represent (like a phone keypad). Return an empty list for empty input.\n\nMapping: 2→abc, 3→def, 4→ghi, 5→jkl, 6→mno, 7→pqrs, 8→tuv, 9→wxyz",
        "difficulty": "medium",
        "language": "python",
        "topic": ["backtracking", "strings", "recursion"],
        "examples": [
            {"input": "digits=\"23\"", "output": "['ad','ae','af','bd','be','bf','cd','ce','cf']", "explanation": "All combinations of letters for '2' (abc) and '3' (def)."},
            {"input": "digits=\"\"", "output": "[]", "explanation": "Empty input returns empty list."},
        ],
        "constraints": "0 ≤ digits.length ≤ 4\ndigits[i] is a digit in ['2','9'].",
        "hints": ["Use a dictionary mapping digits to their letters.", "Recurse: for each position, iterate over the letters for that digit and append to the current combination."],
        "sort_order": 3042,
        "source": "curated",
    },
    # ---- GRAPHS (need ~3 more medium) ----
    {
        "title": "Breadth-First Search",
        "slug": "breadth-first-search",
        "description": "Given an undirected graph represented as an adjacency list and a start node, perform a BFS and return the order in which nodes are visited. Nodes at the same level are visited in sorted order.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["graph", "queue", "searching"],
        "examples": [
            {"input": "graph = {0:[1,2], 1:[0,3,4], 2:[0], 3:[1], 4:[1]}\nstart = 0", "output": "[0, 1, 2, 3, 4]", "explanation": "Start at 0; visit neighbors 1 and 2 (sorted); then 1's unvisited neighbors 3 and 4."},
        ],
        "constraints": "1 ≤ number of nodes ≤ 10^4\nThe graph is undirected and may not be connected.",
        "hints": ["Use a deque as the BFS queue and a set for visited nodes.", "Enqueue the start node, mark it visited, then process each node by enqueueing its unvisited neighbors."],
        "sort_order": 3050,
        "source": "curated",
    },
    {
        "title": "Depth-First Search",
        "slug": "depth-first-search",
        "description": "Given an undirected graph as an adjacency list and a start node, perform a DFS and return the order in which nodes are visited. When multiple neighbors are available, visit them in sorted order.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["graph", "searching", "recursion"],
        "examples": [
            {"input": "graph = {0:[1,2], 1:[0,3,4], 2:[0], 3:[1], 4:[1]}\nstart = 0", "output": "[0, 1, 3, 4, 2]", "explanation": "DFS from 0: go deep through 1→3, backtrack to 4, backtrack to 2."},
        ],
        "constraints": "1 ≤ number of nodes ≤ 10^4\nThe graph is undirected and may not be connected.",
        "hints": ["Use a set for visited nodes and recurse.", "Alternatively use an explicit stack (iterative DFS)."],
        "sort_order": 3051,
        "source": "curated",
    },
    {
        "title": "Number of Connected Components",
        "slug": "number-connected-components",
        "description": "Given `n` nodes labeled 0 to n-1 and a list of undirected edges, return the number of connected components in the graph.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["graph", "searching", "arrays"],
        "examples": [
            {"input": "n=5, edges=[[0,1],[1,2],[3,4]]", "output": "2", "explanation": "Component 1: {0,1,2}. Component 2: {3,4}."},
            {"input": "n=5, edges=[[0,1],[1,2],[2,3],[3,4]]", "output": "1", "explanation": "All nodes are connected."},
        ],
        "constraints": "1 ≤ n ≤ 2000\n1 ≤ edges.length ≤ 5000\nedges[i].length == 2; 0 ≤ a_i, b_i < n; a_i != b_i; No repeated edges.",
        "hints": ["Build an adjacency list, then BFS/DFS from each unvisited node, counting how many times you start a new traversal.", "Union-Find (Disjoint Set Union) also works efficiently."],
        "sort_order": 3052,
        "source": "curated",
    },
    {
        "title": "Has Path in Directed Graph",
        "slug": "has-path-directed-graph",
        "description": "Given a directed acyclic graph (DAG) represented as an adjacency list, a source node, and a destination node, return `True` if there is a path from source to destination, `False` otherwise.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["graph", "searching", "recursion"],
        "examples": [
            {"input": "graph = {0:[1,2], 1:[3], 2:[3], 3:[]}\nsrc=0, dst=3", "output": "True", "explanation": "Path exists: 0 → 1 → 3 or 0 → 2 → 3."},
            {"input": "graph = {0:[1], 1:[2], 2:[]}\nsrc=0, dst=3", "output": "False", "explanation": "Node 3 is not in the graph."},
        ],
        "constraints": "0 ≤ number of nodes ≤ 200\nGraph has no cycles.",
        "hints": ["DFS or BFS from source. If you reach destination, return True.", "Use a visited set to avoid infinite loops (even in a DAG it's good practice)."],
        "sort_order": 3053,
        "source": "curated",
    },
    # ---- SORTING (need ~4 more medium) ----
    {
        "title": "Merge Sorted Arrays",
        "slug": "merge-sorted-arrays",
        "description": "Given two sorted integer arrays `nums1` and `nums2`, merge them into one sorted array. The first array has `m` valid elements and extra space at the end for the `n` elements of `nums2`. Modify `nums1` in-place.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["sorting", "arrays", "two-pointers"],
        "examples": [
            {"input": "nums1=[1,2,3,0,0,0], m=3\nnums2=[2,5,6], n=3", "output": "[1,2,2,3,5,6]", "explanation": "Merge both sorted arrays."},
            {"input": "nums1=[1], m=1\nnums2=[], n=0", "output": "[1]", "explanation": "Nothing to merge."},
        ],
        "constraints": "nums1.length == m + n\nnums2.length == n\n0 ≤ m, n ≤ 200\n-10^9 ≤ nums1[i], nums2[i] ≤ 10^9",
        "hints": ["Start from the back. Use two pointers at the last valid position of each array and fill nums1 from the end.", "This avoids overwriting elements you haven't read yet."],
        "sort_order": 3060,
        "source": "curated",
    },
    {
        "title": "Sort by Frequency",
        "slug": "sort-by-frequency",
        "description": "Given a list of integers, sort them by frequency (most frequent first). For elements with the same frequency, sort them in decreasing order of value.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["sorting", "hash-map", "arrays"],
        "examples": [
            {"input": "[1,1,2,2,2,3]", "output": "[2,2,2,1,1,3]", "explanation": "2 appears 3 times, 1 twice, 3 once."},
            {"input": "[2,3,1,3,2]", "output": "[3,3,2,2,1]", "explanation": "Both 3 and 2 appear twice; 3 > 2 so 3 comes first."},
        ],
        "constraints": "1 ≤ nums.length ≤ 10^5\n-10^4 ≤ nums[i] ≤ 10^4",
        "hints": ["Count frequencies with Counter.", "Sort using a key: (-frequency, -value) to sort by frequency descending, then value descending."],
        "sort_order": 3061,
        "source": "curated",
    },
    {
        "title": "Largest Number",
        "slug": "largest-number",
        "description": "Given a list of non-negative integers, arrange them such that they form the largest possible number and return it as a string. The result may be very large, so return it as a string, not an integer.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["sorting", "strings", "greedy"],
        "examples": [
            {"input": "[10, 2]", "output": "\"210\"", "explanation": "'2' + '10' = '210' > '10' + '2' = '102'."},
            {"input": "[3, 30, 34, 5, 9]", "output": "\"9534330\"", "explanation": "Optimal arrangement is 9, 5, 34, 3, 30."},
            {"input": "[0, 0]", "output": "\"0\"", "explanation": "Special case: all zeros → result is '0'."},
        ],
        "constraints": "1 ≤ nums.length ≤ 100\n0 ≤ nums[i] ≤ 10^9",
        "hints": ["Custom comparator: for two numbers x and y, prefer x over y if str(x)+str(y) > str(y)+str(x).", "Use functools.cmp_to_key to pass a comparator to sorted()."],
        "sort_order": 3062,
        "source": "curated",
    },
    {
        "title": "Group Anagrams",
        "slug": "group-anagrams",
        "description": "Given a list of strings, group the anagrams together. Each group must be a list of strings. The answer can be in any order.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["sorting", "hash-map", "strings"],
        "examples": [
            {"input": "[\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]", "output": "[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]", "explanation": "Three groups of anagrams."},
            {"input": "[\"\"]", "output": "[[\"\"]]", "explanation": "Single empty string."},
        ],
        "constraints": "1 ≤ strs.length ≤ 10^4\n0 ≤ strs[i].length ≤ 100\nstrs[i] consists of lowercase English letters.",
        "hints": ["The canonical form of a word is its sorted characters. Words with the same sorted form are anagrams.", "Use a dict mapping sorted_chars → list of anagram strings."],
        "sort_order": 3063,
        "source": "curated",
    },
    # ---- RECURSION (need ~3 more) ----
    {
        "title": "Power Function",
        "slug": "power-function",
        "description": "Implement `pow(x, n)` — compute `x` raised to the power `n` (x^n). Handle negative `n` and `x = 0`.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["recursion", "math", "binary-search"],
        "examples": [
            {"input": "x=2.00, n=10", "output": "1024.0", "explanation": "2^10 = 1024."},
            {"input": "x=2.10, n=3", "output": "9.261", "explanation": "2.1^3 = 9.261."},
            {"input": "x=2.00, n=-2", "output": "0.25", "explanation": "2^(-2) = 1/4 = 0.25."},
        ],
        "constraints": "-100.0 < x < 100.0\n-2^31 ≤ n ≤ 2^31 - 1\nn is an integer.\n-10^4 ≤ x^n ≤ 10^4",
        "hints": ["Fast exponentiation: pow(x, n//2) squared, times x if n is odd.", "Handle negative n by computing pow(1/x, -n)."],
        "sort_order": 3070,
        "source": "curated",
    },
    {
        "title": "Tower of Hanoi",
        "slug": "tower-of-hanoi",
        "description": "Solve the Tower of Hanoi puzzle. Given `n` disks on peg 'A', move them all to peg 'C' using peg 'B' as auxiliary. A larger disk may never be placed on top of a smaller one. Return the list of moves as `(from_peg, to_peg)` tuples.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["recursion", "arrays"],
        "examples": [
            {"input": "n=2", "output": "[('A','B'), ('A','C'), ('B','C')]", "explanation": "Move disk 1 to B, disk 2 to C, disk 1 to C."},
            {"input": "n=1", "output": "[('A','C')]", "explanation": "Single disk moved directly."},
        ],
        "constraints": "1 ≤ n ≤ 15",
        "hints": ["hanoi(n, src, dst, aux): move n-1 from src to aux, move 1 from src to dst, move n-1 from aux to dst.", "The number of moves is 2^n - 1."],
        "sort_order": 3071,
        "source": "curated",
    },
    {
        "title": "Count Ways to Climb Stairs",
        "slug": "count-ways-climb-stairs",
        "description": "You are climbing a staircase with `n` steps. At each step you can climb 1 or 2 steps. Return the number of distinct ways to reach the top.",
        "difficulty": "easy",
        "language": "python",
        "topic": ["recursion", "dynamic-programming", "math"],
        "examples": [
            {"input": "n=2", "output": "2", "explanation": "Two ways: (1,1) or (2)."},
            {"input": "n=3", "output": "3", "explanation": "Three ways: (1,1,1), (1,2), (2,1)."},
            {"input": "n=5", "output": "8", "explanation": "Eight distinct ways."},
        ],
        "constraints": "1 ≤ n ≤ 45",
        "hints": ["Recurrence: ways(n) = ways(n-1) + ways(n-2) with ways(1)=1, ways(2)=2.", "Use memoization or dynamic programming to avoid recomputation."],
        "sort_order": 3072,
        "source": "curated",
    },
    # ---- SEARCHING (2 more easy/medium) ----
    {
        "title": "Jump Search",
        "slug": "jump-search",
        "description": "Implement the jump search algorithm on a sorted list. Jump search works by jumping ahead by a fixed block size √n, then doing a linear search within the identified block. Return the index of the target, or -1 if not found.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["searching", "arrays", "math"],
        "examples": [
            {"input": "arr=[1,3,5,7,9,11,13,15], target=7", "output": "3", "explanation": "7 is at index 3."},
            {"input": "arr=[1,3,5,7,9,11,13,15], target=6", "output": "-1", "explanation": "6 is not in the array."},
        ],
        "constraints": "1 ≤ arr.length ≤ 10^5\n-10^9 ≤ arr[i], target ≤ 10^9\nArray is sorted in ascending order.",
        "hints": ["Block size: int(math.sqrt(len(arr))).", "Jump to indices 0, step, 2*step, … until you overshoot or find the block, then do linear search backwards."],
        "sort_order": 3080,
        "source": "curated",
    },
    {
        "title": "Find K Closest Elements",
        "slug": "find-k-closest-elements",
        "description": "Given a sorted integer array `arr`, two integers `k` and `x`, return the `k` integers closest to `x`. The result must also be sorted. If two elements are equidistant from `x`, prefer the smaller one.",
        "difficulty": "medium",
        "language": "python",
        "topic": ["searching", "binary-search", "arrays"],
        "examples": [
            {"input": "arr=[1,2,3,4,5], k=4, x=3", "output": "[1,2,3,4]", "explanation": "The 4 closest to 3 are 1,2,3,4 (each is within 2 of x; 5 is 2 away but 1 is closer or equal by the tie-break rule)."},
            {"input": "arr=[1,2,3,4,5], k=4, x=-1", "output": "[1,2,3,4]", "explanation": "The 4 smallest elements are closest to -1."},
        ],
        "constraints": "1 ≤ k ≤ arr.length\n1 ≤ arr.length ≤ 10^4\narr is sorted in ascending order.\n-10^4 ≤ arr[i], x ≤ 10^4",
        "hints": ["Binary search for the left boundary of the k-element window.", "Compare arr[mid] and arr[mid+k] with x: if x - arr[mid] > arr[mid+k] - x, move the window right."],
        "sort_order": 3081,
        "source": "curated",
    },
]


def fix_and_expand(dry_run: bool = False) -> None:
    db = SessionLocal()
    deleted = 0
    tag_fixed = 0
    tag_removed = 0
    constraint_added = 0
    difficulty_fixed = 0
    new_added = 0

    try:
        # ------------------------------------------------------------------
        # Step 1: Delete placeholder Bookmark Test Problems
        # ------------------------------------------------------------------
        placeholders = (
            db.query(Problem)
            .filter(Problem.title.like("Bookmark Test%"))
            .all()
        )
        for p in placeholders:
            print(f"  DEL placeholder: {p.title} (id={p.id})")
            if not dry_run:
                db.delete(p)
        deleted = len(placeholders)

        # ------------------------------------------------------------------
        # Step 2: Fix tags on empty-tag (and mislabelled) problems
        # ------------------------------------------------------------------
        for title, difficulty_override, new_tags in EMPTY_TAG_FIXES:
            probs = db.query(Problem).filter(Problem.title == title).all()
            for p in probs:
                changed = False
                if p.topic != new_tags:
                    print(f"  TAG  {title!r}: {p.topic} → {new_tags}")
                    if not dry_run:
                        p.topic = new_tags
                    tag_fixed += 1
                    changed = True
                if difficulty_override and p.difficulty != difficulty_override:
                    print(f"  DIFF {title!r}: {p.difficulty} → {difficulty_override}")
                    if not dry_run:
                        p.difficulty = difficulty_override
                    difficulty_fixed += 1
                    changed = True

        # ------------------------------------------------------------------
        # Step 3: Remove wrong binary-search tags
        # ------------------------------------------------------------------
        for title, bad_tag in TAG_REMOVALS:
            probs = db.query(Problem).filter(Problem.title == title).all()
            for p in probs:
                if bad_tag in (p.topic or []):
                    new_tags_list = [t for t in p.topic if t != bad_tag]
                    print(f"  RMTAG {title!r}: remove '{bad_tag}' → {new_tags_list}")
                    if not dry_run:
                        p.topic = new_tags_list
                    tag_removed += 1

        # ------------------------------------------------------------------
        # Step 4: Add missing constraints
        # ------------------------------------------------------------------
        seen_titles: set[str] = set()
        for title, constraints_text in CONSTRAINTS_FIXES:
            if title in seen_titles:
                continue
            seen_titles.add(title)
            probs = db.query(Problem).filter(Problem.title == title, Problem.constraints == None).all()
            for p in probs:
                print(f"  CON  {title!r}: add constraints")
                if not dry_run:
                    p.constraints = constraints_text
                constraint_added += 1

        # ------------------------------------------------------------------
        # Step 5: Insert new problems
        # ------------------------------------------------------------------
        for spec in NEW_PROBLEMS:
            existing = db.query(Problem).filter(Problem.slug == spec["slug"]).first()
            if existing:
                print(f"  SKIP (exists): {spec['title']!r}")
                continue
            print(f"  NEW  [{spec['difficulty']}] {spec['title']!r}")
            if not dry_run:
                db.add(
                    Problem(
                        title=spec["title"],
                        slug=spec["slug"],
                        description=spec["description"],
                        difficulty=spec["difficulty"],
                        language=spec["language"],
                        topic=spec["topic"],
                        examples=spec.get("examples", []),
                        constraints=spec.get("constraints"),
                        hints=spec.get("hints"),
                        sort_order=spec.get("sort_order"),
                        source=spec.get("source", "curated"),
                        is_published=True,
                    )
                )
            new_added += 1

        if not dry_run:
            db.commit()

        print()
        print(
            f"Done (dry_run={dry_run}): "
            f"{deleted} deleted, "
            f"{tag_fixed} tags fixed, "
            f"{tag_removed} bad tags removed, "
            f"{constraint_added} constraints added, "
            f"{difficulty_fixed} difficulties corrected, "
            f"{new_added} new problems added"
        )

    finally:
        db.close()


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN — no changes will be committed ===\n")
    fix_and_expand(dry_run=dry_run)
