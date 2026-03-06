.PHONY: dev dev-local dev-backend dev-frontend test test-backend test-frontend generate migrate new-feature lint-arch lint storybook help build build-tier-1 build-tier-2 build-tier-3 validate spec aider-fill-in aider-debug aider-review

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

spec: ## Print a SPECS.md section template (usage: make spec name=orders tier=2)
	@echo ""
	@echo "### Feature: $(name) (tier $(or $(tier),1), backend + frontend)"
	@echo ""
	@echo "- **Purpose:** TODO - what problem does this solve?"
	@echo "- **Rules:**"
	@echo "  - TODO - business rule 1"
	@echo "  - TODO - business rule 2"
	@echo "- **User stories:**"
	@echo "  - As a [role], I want to [action] so that [benefit]."
	@echo "- **API:**"
	@echo "  - \`POST /api/$(name)s\` — Create a $(name)"
	@echo "  - \`GET /api/$(name)s/:id\` — Get $(name) details"
	@echo ""
	@echo "Copy the above into SPECS.md under '## Features & Business Rules'"
	@echo ""

lint-arch: ## Run architecture boundary linter
	python shared/scripts/lint-architecture.py

storybook: ## Start Storybook dev server
	cd frontend && npx storybook dev -p 6006

lint: ## Run all linters
	cd backend && ruff check .
	cd frontend && npx ng lint

validate: lint-arch lint test ## Validate everything: architecture + linters + tests

build: ## Build all services for tier 3 (all features)
	TIER=3 docker compose build

build-tier-1: ## Build for tier 1 (minimal features)
	TIER=1 docker compose build --build-arg TIER=1

build-tier-2: ## Build for tier 2
	TIER=2 docker compose build --build-arg TIER=2

build-tier-3: ## Build for tier 3 (all features)
	TIER=3 docker compose build --build-arg TIER=3

# ── Aider Sessions ───────────────────────────────────────────
# Default config; override with: make aider-fill-in AIDER_CONF=.aider-codestral.conf.yml
AIDER_CONF ?= .aider-glm.conf.yml

aider-fill-in: ## Fill in a scaffolded feature with TDD (step 3 of feature workflow)
	aider --config $(AIDER_CONF) --read prompts/aider/fill-in.md

aider-debug: ## Systematic debugging session
	aider --config $(AIDER_CONF) --read prompts/aider/debug.md

aider-review: ## Review code against project rules
	aider --config $(AIDER_CONF) --read prompts/aider/review.md
