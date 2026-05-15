from db.session import SessionLocal
from models.billing import Plan


def seed_plans() -> None:
    db = SessionLocal()
    try:
        if db.query(Plan).count() > 0:
            print("Plans already seeded, skipping.")
            return
        db.add_all([
            Plan(
                name="Free",
                price_monthly=0.0,
                price_yearly=0.0,
                allowed_models=["anthropic/claude-sonnet-4-5", "google/gemini-2.0-flash", "meta-llama/llama-3.3-70b"],
                llm_calls_per_month=50,
                max_seats=1,
                features={"code_review": True, "hints": True, "teach_me": True, "surprise_me": True},
                is_active=True,
            ),
            Plan(
                name="Pro",
                price_monthly=12.0,
                price_yearly=99.0,
                allowed_models=["anthropic/claude-sonnet-4-5", "openai/gpt-4o", "google/gemini-2.0-flash", "meta-llama/llama-3.3-70b"],
                llm_calls_per_month=500,
                max_seats=1,
                features={"code_review": True, "hints": True, "teach_me": True, "surprise_me": True, "advanced_models": True},
                is_active=True,
            ),
        ])
        db.commit()
        print("Seeded 2 plans.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_plans()
