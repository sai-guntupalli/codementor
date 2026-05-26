"""Unit tests for fallback LLM cost computation."""

import pytest

from llm.pricing import compute_cost


def test_compute_cost_known_model():
    cost = compute_cost("anthropic/claude-sonnet-4-5", input_tokens=1000, output_tokens=500)
    # 1000 * 0.003/1000 + 500 * 0.015/1000 = 0.003 + 0.0075 = 0.0105
    assert cost == pytest.approx(0.0105, rel=1e-4)


def test_compute_cost_unknown_model_uses_default():
    cost = compute_cost("unknown/vendor-model", input_tokens=1000, output_tokens=1000)
    # default: 0.003 + 0.015 = 0.018
    assert cost == pytest.approx(0.018, rel=1e-4)

