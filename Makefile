.PHONY: install dev-backend dev-frontend test lint format build \
        docker-up docker-down docker-build docker-logs docker-restart \
        piston-up piston-init piston-down \
        scrape-oss insert-oss scrape-leetcode ingest-leetcode migrate generate-hints apply-hints help

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

docker-restart: ## Rebuild images and recreate all containers
	docker compose up -d --build --force-recreate
	@echo ""
	@echo "  Frontend → http://localhost:3000"
	@echo "  Backend  → http://localhost:8000"
	@echo "  Piston   → http://localhost:2000"

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

scrape-leetcode: ## Fetch Garvit244/Leetcode → backend/seeds/data/garvit_leetcode.json
	cd backend && uv run python -m seeds.ingest_leetcode --scrape-only

ingest-leetcode: ## Scrape Garvit244/Leetcode and insert problems + solutions into DB
	cd backend && uv run python -m seeds.ingest_leetcode

enrich-problems: ## Bulk-enrich problem tags+difficulty via Claude Haiku (writes enriched_patch.json)
	cd backend && uv run python -m seeds.enrich_problems

apply-enrichment: ## Apply enriched_patch.json to DB
	cd backend && uv run python -m seeds.enrich_problems --apply

generate-hints: ## Bulk-prefetch hints via Haiku (optional; runtime lazy-generates on first hint)
	cd backend && uv run python -m seeds.generate_hints --only-missing

apply-hints: ## Apply hints_patch.json to problems.hints in DB
	cd backend && uv run python -m seeds.generate_hints --apply

sync-curated: ## Sync curated descriptions/examples into DB (default: fizzbuzz)
	cd backend && uv run python -m seeds.sync_curated

normalize-problems: ## LLM-rewrite problem copy → seeds/data/normalized_patch.json
	cd backend && uv run python -m seeds.normalize_problems

apply-normalization: ## Apply normalized_patch.json + strip curriculum title prefixes
	cd backend && uv run python -m seeds.normalize_problems --apply

strip-problem-titles: ## Strip 01.5-style prefixes from all problem titles in DB
	cd backend && uv run python -m seeds.strip_problem_titles

fix-random-examples: ## Fix random tasks that had deterministic test examples
	cd backend && uv run python -m seeds.fix_nondeterministic_examples

seed-learning-paths: ## Create curated learning paths (one per topic)
	cd backend && uv run python -m seeds.learning_paths --sync

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
