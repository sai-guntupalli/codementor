from db.session import SessionLocal
from models.learning import Problem


SAMPLE_PROBLEMS = [
    {
        "title": "Hello, Print",
        "description": "Write a program that prints the string `Hello, CodeMentor!` to stdout.",
        "language": "python",
        "difficulty": "easy",
        "topic": ["basics", "io"],
        "examples": {
            "input": "(none)",
            "output": "Hello, CodeMentor!",
            "explanation": "Your program should print exactly one line matching the expected output.",
        },
        "constraints": "Use exactly one print statement.",
        "source": "curated",
        "is_published": True,
    },
]


def seed_problems() -> None:
    db = SessionLocal()
    try:
        if db.query(Problem).filter(Problem.title == "Hello, Print").first():
            print("Problems already seeded, skipping.")
            return
        db.add_all([Problem(**p) for p in SAMPLE_PROBLEMS])
        db.commit()
        print(f"Seeded {len(SAMPLE_PROBLEMS)} problems.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_problems()
