.PHONY: install dev-backend dev-frontend test lint format build help

install: ## Install all dependencies
	cd backend && uv sync
	cd frontend && npm install

dev-backend: ## Start backend dev server (port 8000)
	cd backend && uv run uvicorn main:app --reload --port 8000

dev-frontend: ## Start frontend dev server (port 3000)
	cd frontend && npm run dev

test: ## Run all tests
	cd backend && uv run pytest -v

lint: ## Lint all code
	cd backend && uv run ruff check .
	cd frontend && npm run lint

format: ## Auto-format all code
	cd backend && uv run ruff format .

build: ## Build frontend for production
	cd frontend && npm run build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
