"""Unit tests for per-minute rate limiting."""

import pytest
from fastapi import HTTPException

from llm import rate_limit


@pytest.fixture(autouse=True)
def clear_rate_windows():
    rate_limit._windows.clear()
    yield
    rate_limit._windows.clear()


def test_rate_limit_allows_within_window():
    user_id = "user-a"
    for _ in range(10):
        rate_limit.check(user_id=user_id, tier="free")


def test_rate_limit_blocks_eleventh_call():
    user_id = "user-b"
    for _ in range(10):
        rate_limit.check(user_id=user_id, tier="free")

    with pytest.raises(HTTPException) as exc:
        rate_limit.check(user_id=user_id, tier="free")
    assert exc.value.status_code == 429
    assert exc.value.headers.get("Retry-After") == "60"
