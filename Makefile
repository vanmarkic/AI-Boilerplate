.PHONY: dev dev-local dev-backend dev-frontend test test-backend test-frontend generate migrate new-feature lint-arch lint storybook help build build-tier-1 build-tier-2 build-tier-3 aider-brainstorm aider-tdd aider-debug aider-plan aider-execute aider-verify aider-finish

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services via Docker Compose (full Docker)
	docker compose up --build

dev-local: ## Start db+api in Docker, Angular natively — best DX, instant HMR
	docker compose up -d db api
	cd frontend && npx ng serve

dev-backend: ## Start backend + db only (Docker)
	docker compose up --build api db

dev-frontend: ## Start Angular dev server natively (expects backend running)
	cd frontend && npx ng serve

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd backend && python -m pytest -v

test-frontend: ## Run frontend tests
	cd frontend && npx ng test --watch=false --browsers=ChromeHeadless

generate: ## Regenerate types from OpenAPI spec
	bash shared/scripts/generate-backend.sh
	bash shared/scripts/generate-frontend.sh

migrate: ## Run database migrations
	cd backend && alembic upgrade head

new-feature: ## Scaffold a new feature (usage: make new-feature name=orders tier=2)
	bash shared/scripts/scaffold-feature.sh $(name) $(tier)

lint-arch: ## Run architecture boundary linter
	python shared/scripts/lint-architecture.py

storybook: ## Start Storybook dev server
	cd frontend && npx storybook dev -p 6006

lint: ## Run all linters
	cd backend && ruff check .
	cd frontend && npx ng lint

build: ## Build all services for tier 3 (all features)
	TIER=3 docker compose build

build-tier-1: ## Build for tier 1 (minimal features)
	TIER=1 docker compose build --build-arg TIER=1

build-tier-2: ## Build for tier 2
	TIER=2 docker compose build --build-arg TIER=2

build-tier-3: ## Build for tier 3 (all features)
	TIER=3 docker compose build --build-arg TIER=3

# ── Aider Skills ──────────────────────────────────────────────
# Default config; override with: make aider-tdd AIDER_CONF=.aider-codestral.conf.yml
AIDER_CONF ?= .aider-glm.conf.yml

aider-brainstorm: ## Brainstorm a feature with aider (usage: make aider-brainstorm)
	aider --config $(AIDER_CONF) --read prompts/aider/brainstorm.md

aider-tdd: ## Start TDD session with aider (usage: make aider-tdd)
	aider --config $(AIDER_CONF) --read prompts/aider/tdd.md

aider-debug: ## Start systematic debugging session (usage: make aider-debug)
	aider --config $(AIDER_CONF) --read prompts/aider/debug.md

aider-plan: ## Write an implementation plan (usage: make aider-plan)
	aider --config $(AIDER_CONF) --read prompts/aider/write-plan.md

aider-execute: ## Execute an implementation plan (usage: make aider-execute)
	aider --config $(AIDER_CONF) --read prompts/aider/execute-plan.md

aider-verify: ## Verify work is complete (usage: make aider-verify)
	aider --config $(AIDER_CONF) --read prompts/aider/verify.md

aider-finish: ## Finish a development branch (usage: make aider-finish)
	aider --config $(AIDER_CONF) --read prompts/aider/finish-branch.md
