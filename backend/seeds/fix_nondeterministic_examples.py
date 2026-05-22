"""Fix problems where random output was paired with deterministic test examples."""

from __future__ import annotations

from db.session import SessionLocal
from models.learning import Problem

# Slug → fields to overwrite (faithful to original 4Geeks / runnable stdin rules)
FIXES: dict[str, dict] = {
    "4geeks-Random-Numbers": {
        "description": (
            "Write a function `random_number()` that returns a random integer between "
            "1 and 100 (inclusive). Use `random.randint()`."
        ),
        "examples": [
            {
                "input": "(none)",
                "output": "42",
                "explanation": "Each call returns a different integer from 1 to 100.",
            },
            {
                "input": "(none)",
                "output": "17",
                "explanation": "Run your function several times to see different values.",
            },
        ],
        "constraints": "Use `random.randint(1, 100)`. Return an `int`, not a string.",
    },
    "4geeks-Random-Colors-Loop": {
        "examples": [
            {
                "input": "(none)",
                "output": "['red', 'blue', 'green', 'yellow', 'red', 'blue', 'red', 'green', 'yellow', 'blue']",
                "explanation": (
                    "Ten colors chosen from red, yellow, blue, and green. Your list will "
                    "differ each run."
                ),
            },
            {
                "input": "(none)",
                "output": "['green', 'green', 'red', 'yellow', 'blue', 'blue', 'red', 'yellow', 'green', 'red']",
                "explanation": "Another possible assignment — length is always 10.",
            },
        ],
        "constraints": (
            "Return a list of exactly 10 color strings. Colors must be one of: "
            "red, yellow, blue, green."
        ),
    },
    "4geeks-Create-A-New-Function": {
        "examples": [
            {
                "input": "(none)",
                "output": "Hello, Alice!",
                "explanation": "Calling `greet('Alice')` should return this greeting string.",
            },
            {
                "input": "(none)",
                "output": "73",
                "explanation": (
                    "`random_number()` returns an int between 1 and 100; the value changes "
                    "each call."
                ),
            },
            {
                "input": "(none)",
                "output": "Hello, Bob!",
                "explanation": "Calling `greet('Bob')` uses the name argument in the message.",
            },
        ],
    },
}


def apply_fixes() -> int:
    db = SessionLocal()
    updated = 0
    try:
        for slug, fields in FIXES.items():
            row = db.query(Problem).filter(Problem.slug == slug).first()
            if not row:
                print(f"  skip [{slug}]: not in DB")
                continue
            for key, value in fields.items():
                setattr(row, key, value)
            updated += 1
            print(f"  updated [{slug}]")
        db.commit()
        return updated
    finally:
        db.close()


if __name__ == "__main__":
    n = apply_fixes()
    print(f"Done: {n} problem(s) updated")
