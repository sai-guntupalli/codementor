"""Activate v2 prompt templates (run after pulling prompt updates)."""

from db.session import SessionLocal
from models.content import Prompt
from seeds.prompts import PROMPTS


def upgrade_prompts() -> None:
    db = SessionLocal()
    try:
        updated = 0
        for spec in PROMPTS:
            db.query(Prompt).filter(Prompt.name == spec["name"]).update(
                {"is_active": False}, synchronize_session=False
            )
            existing = (
                db.query(Prompt)
                .filter(Prompt.name == spec["name"], Prompt.version == spec["version"])
                .first()
            )
            if existing:
                existing.template = spec["template"]
                existing.variables = spec["variables"]
                existing.is_active = True
            else:
                db.add(Prompt(**spec, is_active=True))
            updated += 1
        db.commit()
        print(f"Upgraded {updated} prompts to active v{PROMPTS[0]['version']}.")
    finally:
        db.close()


if __name__ == "__main__":
    upgrade_prompts()
