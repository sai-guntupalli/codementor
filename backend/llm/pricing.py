"""Fallback cost computation from model_pricing.yaml."""

from pathlib import Path

import yaml

_PRICING_PATH = Path(__file__).parent.parent / "config" / "model_pricing.yaml"

with _PRICING_PATH.open() as _f:
    _PRICING: dict[str, dict[str, float]] = yaml.safe_load(_f)


def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return USD cost using config/model_pricing.yaml. Falls back to _default."""
    rates = _PRICING.get(model, _PRICING["_default"])
    cost = (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1000
    return round(cost, 6)
