"""In-process sliding-window rate limiter for LLM calls."""

from collections import deque
from datetime import datetime, timezone

from fastapi import HTTPException, status

RATE_LIMIT_CONFIG: dict[str, dict[str, int]] = {
    "free": {"calls": 10, "window_seconds": 60},
    "pro": {"calls": 30, "window_seconds": 60},
}

_FALLBACK_TIER = "free"

# user_id -> deque of UTC timestamps (float)
_windows: dict[str, deque[float]] = {}


def check(user_id: str, tier: str) -> None:
    """Raise HTTP 429 with Retry-After header if the per-minute rate is exceeded."""
    config = RATE_LIMIT_CONFIG.get(tier, RATE_LIMIT_CONFIG[_FALLBACK_TIER])
    limit = config["calls"]
    window = config["window_seconds"]

    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - window

    if user_id not in _windows:
        _windows[user_id] = deque()

    bucket = _windows[user_id]

    # Prune timestamps outside the sliding window
    while bucket and bucket[0] < cutoff:
        bucket.popleft()

    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests — slow down",
            headers={"Retry-After": str(window)},
        )

    bucket.append(now)
