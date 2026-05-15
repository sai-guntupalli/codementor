.PHONY: install dev test lint format check

install:
	uv sync

dev:
	uv run uvicorn main:app --reload --port 8000

test:
	uv run pytest -v

lint:
	uv run ruff check .

format:
	uv run ruff format .

check: lint
	uv run ruff format --check .
	uv run pytest -v
