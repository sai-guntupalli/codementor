.PHONY: install dev-backend dev-frontend test lint format build \
        docker-up docker-down docker-build docker-logs docker-restart \
        piston-up piston-init piston-down \
        scrape-oss insert-oss migrate help

# ── Local development ────────────────────────────────────────────
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

build: ## Build frontend for production (local)
	cd frontend && npm run build

# ── Docker ───────────────────────────────────────────────────────
docker-build: ## Build all Docker images
	docker compose build

docker-up: ## Start all services (build if needed)
	docker compose up -d --build
	@echo ""
	@echo "  Frontend → http://localhost:3000"
	@echo "  Backend  → http://localhost:8000"
	@echo "  Piston   → http://localhost:2000"

docker-down: ## Stop and remove all containers
	docker compose down

docker-logs: ## Tail logs from all services (Ctrl+C to stop)
	docker compose logs -f

docker-restart: ## Restart all containers without rebuilding
	docker compose restart

piston-init: ## Install Python runtime into Piston (run once after docker-up)
	@echo "Waiting for Piston to be ready..."
	@until curl -sf http://localhost:2000/api/v2/runtimes > /dev/null; do sleep 2; done
	curl -s -X POST http://localhost:2000/api/v2/packages \
		-H "Content-Type: application/json" \
		-d '{"language":"python","version":"3.10.0"}' | cat

# ── Legacy aliases (kept for backward compatibility) ─────────────
piston-up: ## Start only the Piston service
	docker compose up -d piston

piston-down: ## Stop all Docker services
	docker compose down

migrate: ## Apply pending Alembic migrations
	cd backend && uv run alembic upgrade head

scrape-oss: ## Clone OSS repos and parse into backend/seeds/data/oss_problems.json (dry run)
	cd backend && uv run python -m seeds.ingest_oss

insert-oss: ## Insert backend/seeds/data/oss_problems.json into DB (run after reviewing)
	cd backend && uv run python -m seeds.ingest_oss --insert

enrich-problems: ## Bulk-enrich problem tags+difficulty via Claude Haiku (writes enriched_patch.json)
	cd backend && uv run python -m seeds.enrich_problems

apply-enrichment: ## Apply enriched_patch.json to DB
	cd backend && uv run python -m seeds.enrich_problems --apply

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
