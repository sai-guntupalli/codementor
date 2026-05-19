"""25 hand-written absolute-beginner Python problems (stdin/stdout style)."""

CURATED_PROBLEMS: list[dict] = [
    {
        "title": "Hello World",
        "slug": "hello-world",
        "description": "Print `Hello, World!` to stdout.",
        "difficulty": "easy",
        "topic": ["basics", "io"],
        "examples": [
            {"input": "(none)", "output": "Hello, World!"},
        ],
        "constraints": "No input required.",
        "sort_order": 1,
    },
    {
        "title": "Print Your Name",
        "slug": "print-your-name",
        "description": "Read a name from stdin and print `Hello, <name>!`.",
        "difficulty": "easy",
        "topic": ["basics", "io", "strings"],
        "examples": [
            {"input": "Alice", "output": "Hello, Alice!"},
            {"input": "Bob", "output": "Hello, Bob!"},
        ],
        "constraints": "The name contains only letters.",
        "sort_order": 2,
    },
    {
        "title": "Add Two Numbers",
        "slug": "add-two-numbers",
        "description": (
            "Read two integers from stdin (one per line) and print their sum."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "3\n5", "output": "8"},
            {"input": "10\n20", "output": "30"},
            {"input": "-4\n7", "output": "3"},
        ],
        "constraints": "-10^6 ≤ a, b ≤ 10^6",
        "sort_order": 3,
    },
    {
        "title": "Subtract Two Numbers",
        "slug": "subtract-two-numbers",
        "description": (
            "Read two integers a and b (one per line) and print a - b."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "10\n3", "output": "7"},
            {"input": "5\n8", "output": "-3"},
            {"input": "0\n0", "output": "0"},
        ],
        "constraints": "-10^6 ≤ a, b ≤ 10^6",
        "sort_order": 4,
    },
    {
        "title": "Multiply Two Numbers",
        "slug": "multiply-two-numbers",
        "description": (
            "Read two integers a and b (one per line) and print their product."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "4\n5", "output": "20"},
            {"input": "6\n7", "output": "42"},
            {"input": "0\n100", "output": "0"},
        ],
        "constraints": "-10^4 ≤ a, b ≤ 10^4",
        "sort_order": 5,
    },
    {
        "title": "Divide Two Numbers",
        "slug": "divide-two-numbers",
        "description": (
            "Read two integers a and b. Print the result of integer division a // b."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "10\n3", "output": "3"},
            {"input": "20\n4", "output": "5"},
            {"input": "7\n2", "output": "3"},
        ],
        "constraints": "b ≠ 0. Both values are positive integers.",
        "sort_order": 6,
    },
    {
        "title": "Reverse a String",
        "slug": "reverse-a-string",
        "description": "Read a string and print it reversed.",
        "difficulty": "easy",
        "topic": ["strings"],
        "examples": [
            {"input": "hello", "output": "olleh"},
            {"input": "Python", "output": "nohtyP"},
            {"input": "abcde", "output": "edcba"},
        ],
        "constraints": "The string has 1–100 characters.",
        "sort_order": 7,
    },
    {
        "title": "Uppercase String",
        "slug": "uppercase-string",
        "description": "Read a string and print it in uppercase.",
        "difficulty": "easy",
        "topic": ["strings"],
        "examples": [
            {"input": "hello", "output": "HELLO"},
            {"input": "Python", "output": "PYTHON"},
            {"input": "code mentor", "output": "CODE MENTOR"},
        ],
        "constraints": "The string contains only ASCII characters.",
        "sort_order": 8,
    },
    {
        "title": "Count Characters",
        "slug": "count-characters",
        "description": "Read a string and print the number of characters it contains.",
        "difficulty": "easy",
        "topic": ["strings"],
        "examples": [
            {"input": "hello", "output": "5"},
            {"input": "Python", "output": "6"},
            {"input": "a", "output": "1"},
        ],
        "constraints": "The string has 1–1000 characters.",
        "sort_order": 9,
    },
    {
        "title": "Odd or Even",
        "slug": "odd-or-even",
        "description": "Read an integer and print `Odd` if it is odd, or `Even` if it is even.",
        "difficulty": "easy",
        "topic": ["conditionals", "math"],
        "examples": [
            {"input": "4", "output": "Even"},
            {"input": "7", "output": "Odd"},
            {"input": "0", "output": "Even"},
        ],
        "constraints": "-10^6 ≤ n ≤ 10^6",
        "sort_order": 10,
    },
    {
        "title": "Positive or Negative",
        "slug": "positive-or-negative",
        "description": (
            "Read an integer and print `Positive`, `Negative`, or `Zero`."
        ),
        "difficulty": "easy",
        "topic": ["conditionals", "math"],
        "examples": [
            {"input": "5", "output": "Positive"},
            {"input": "-3", "output": "Negative"},
            {"input": "0", "output": "Zero"},
        ],
        "constraints": "-10^6 ≤ n ≤ 10^6",
        "sort_order": 11,
    },
    {
        "title": "FizzBuzz",
        "slug": "fizzbuzz",
        "description": (
            "Read an integer n. Print `Fizz` if divisible by 3, `Buzz` if by 5, "
            "`FizzBuzz` if by both, otherwise print n itself."
        ),
        "difficulty": "easy",
        "topic": ["conditionals", "math"],
        "examples": [
            {"input": "15", "output": "FizzBuzz"},
            {"input": "9", "output": "Fizz"},
            {"input": "10", "output": "Buzz"},
            {"input": "7", "output": "7"},
        ],
        "constraints": "1 ≤ n ≤ 10^6",
        "sort_order": 12,
    },
    {
        "title": "Sum 1 to N",
        "slug": "sum-1-to-n",
        "description": (
            "Read an integer n and print the sum of all integers from 1 to n (inclusive)."
        ),
        "difficulty": "easy",
        "topic": ["loops", "math"],
        "examples": [
            {"input": "5", "output": "15"},
            {"input": "10", "output": "55"},
            {"input": "1", "output": "1"},
        ],
        "constraints": "1 ≤ n ≤ 10^4",
        "sort_order": 13,
    },
    {
        "title": "Countdown",
        "slug": "countdown",
        "description": (
            "Read an integer n and print numbers from n down to 1, one per line, "
            "followed by `Blast off!`."
        ),
        "difficulty": "easy",
        "topic": ["loops", "io"],
        "examples": [
            {"input": "3", "output": "3\n2\n1\nBlast off!"},
            {"input": "5", "output": "5\n4\n3\n2\n1\nBlast off!"},
        ],
        "constraints": "1 ≤ n ≤ 100",
        "sort_order": 14,
    },
    {
        "title": "Multiplication Table",
        "slug": "multiplication-table",
        "description": (
            "Read an integer n and print its multiplication table from 1 to 10. "
            "Each line: `n x i = result`."
        ),
        "difficulty": "easy",
        "topic": ["loops", "math"],
        "examples": [
            {
                "input": "2",
                "output": (
                    "2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n"
                    "2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n2 x 10 = 20"
                ),
            },
        ],
        "constraints": "1 ≤ n ≤ 12",
        "sort_order": 15,
    },
    {
        "title": "Maximum of Three",
        "slug": "maximum-of-three",
        "description": "Read three integers (one per line) and print the largest.",
        "difficulty": "easy",
        "topic": ["conditionals", "math"],
        "examples": [
            {"input": "3\n7\n5", "output": "7"},
            {"input": "10\n2\n8", "output": "10"},
            {"input": "1\n1\n1", "output": "1"},
        ],
        "constraints": "-10^6 ≤ each value ≤ 10^6",
        "sort_order": 16,
    },
    {
        "title": "List Maximum",
        "slug": "list-maximum",
        "description": (
            "Read n on the first line, then n integers (one per line). Print the maximum."
        ),
        "difficulty": "easy",
        "topic": ["lists", "math"],
        "examples": [
            {"input": "4\n3\n1\n9\n2", "output": "9"},
            {"input": "3\n5\n5\n5", "output": "5"},
        ],
        "constraints": "1 ≤ n ≤ 1000. Each value: -10^6 to 10^6.",
        "sort_order": 17,
    },
    {
        "title": "List Minimum",
        "slug": "list-minimum",
        "description": (
            "Read n on the first line, then n integers (one per line). Print the minimum."
        ),
        "difficulty": "easy",
        "topic": ["lists", "math"],
        "examples": [
            {"input": "4\n3\n1\n9\n2", "output": "1"},
            {"input": "3\n-5\n0\n7", "output": "-5"},
        ],
        "constraints": "1 ≤ n ≤ 1000.",
        "sort_order": 18,
    },
    {
        "title": "Sort a List",
        "slug": "sort-a-list",
        "description": (
            "Read n on the first line, then n integers. Print them sorted in ascending order, "
            "space-separated."
        ),
        "difficulty": "easy",
        "topic": ["lists", "sorting"],
        "examples": [
            {"input": "4\n3\n1\n4\n2", "output": "1 2 3 4"},
            {"input": "3\n9\n3\n6", "output": "3 6 9"},
        ],
        "constraints": "1 ≤ n ≤ 1000.",
        "sort_order": 19,
    },
    {
        "title": "Find Item in List",
        "slug": "find-item-in-list",
        "description": (
            "Read n, then n integers, then a target integer. "
            "Print `Found` if the target is in the list, else `Not found`."
        ),
        "difficulty": "easy",
        "topic": ["lists", "search"],
        "examples": [
            {"input": "4\n3\n1\n9\n2\n9", "output": "Found"},
            {"input": "3\n4\n5\n6\n7", "output": "Not found"},
        ],
        "constraints": "1 ≤ n ≤ 1000.",
        "sort_order": 20,
    },
    {
        "title": "Celsius to Fahrenheit",
        "slug": "celsius-to-fahrenheit",
        "description": (
            "Read a temperature in Celsius (float) and print it in Fahrenheit, "
            "rounded to 2 decimal places. Formula: F = C × 9/5 + 32."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "0", "output": "32.00"},
            {"input": "100", "output": "212.00"},
            {"input": "37", "output": "98.60"},
        ],
        "constraints": "-273.15 ≤ C ≤ 10^6",
        "sort_order": 21,
    },
    {
        "title": "Area of a Rectangle",
        "slug": "area-of-a-rectangle",
        "description": (
            "Read width and height (integers, one per line). Print the area."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "5\n3", "output": "15"},
            {"input": "10\n10", "output": "100"},
            {"input": "1\n7", "output": "7"},
        ],
        "constraints": "1 ≤ width, height ≤ 10^4",
        "sort_order": 22,
    },
    {
        "title": "Perimeter of a Rectangle",
        "slug": "perimeter-of-a-rectangle",
        "description": (
            "Read width and height (integers, one per line). Print the perimeter."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "5\n3", "output": "16"},
            {"input": "4\n4", "output": "16"},
            {"input": "1\n10", "output": "22"},
        ],
        "constraints": "1 ≤ width, height ≤ 10^4",
        "sort_order": 23,
    },
    {
        "title": "Square Root",
        "slug": "square-root",
        "description": (
            "Read a non-negative integer n and print its square root rounded to 2 decimal places."
        ),
        "difficulty": "easy",
        "topic": ["math", "io"],
        "examples": [
            {"input": "9", "output": "3.00"},
            {"input": "2", "output": "1.41"},
            {"input": "100", "output": "10.00"},
        ],
        "constraints": "0 ≤ n ≤ 10^8",
        "sort_order": 24,
    },
    {
        "title": "Power of Two",
        "slug": "power-of-two",
        "description": (
            "Read an integer n. Print `Yes` if n is a power of 2, else `No`."
        ),
        "difficulty": "easy",
        "topic": ["math", "conditionals"],
        "examples": [
            {"input": "8", "output": "Yes"},
            {"input": "6", "output": "No"},
            {"input": "1", "output": "Yes"},
            {"input": "0", "output": "No"},
        ],
        "constraints": "0 ≤ n ≤ 10^9",
        "sort_order": 25,
    },
]


def scrape() -> list[dict]:
    return [
        {**p, "source": "curated", "language": "python", "is_published": True}
        for p in CURATED_PROBLEMS
    ]
