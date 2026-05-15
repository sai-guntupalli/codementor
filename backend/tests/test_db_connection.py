from sqlalchemy import inspect, text

from db.session import engine

EXPECTED_TABLES = {
    "users", "organizations", "org_members",
    "plans", "subscriptions", "usage_events",
    "problems", "submissions", "skill_snapshots",
    "chat_sessions", "curriculum_paths", "prompts", "user_settings",
}


def test_database_is_reachable():
    with engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1


def test_all_tables_exist():
    existing = set(inspect(engine).get_table_names())
    missing = EXPECTED_TABLES - existing
    assert not missing, f"Missing tables: {missing}"


def test_plans_seeded(db):
    from models.billing import Plan
    assert db.query(Plan).count() >= 2


def test_prompts_seeded(db):
    from models.content import Prompt
    expected = {"code_review", "hint_generator", "solution_generator", "teach_me", "surprise_me", "skill_assessor"}
    existing = {p.name for p in db.query(Prompt).all()}
    assert not expected - existing, f"Missing prompts: {expected - existing}"
