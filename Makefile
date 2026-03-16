.PHONY: dev dev-local dev-backend dev-frontend dev-tfc dev-tfc-local dev-tfc-frontend dev-tfc-backend test test-backend test-frontend test-tfc-backend test-tfc-frontend test-scaffold generate generate-map-style lock migrate migrate-tfc new-feature lint-arch lint storybook help build build-tier-1 build-tier-2 build-tier-3 validate verify-tier spec aider-fill-in aider-debug aider-review setup-hooks security-scan

# ── Paths ──────────────────────────────────────────────────
MAIN_FE  = apps/main/frontend
MAIN_BE  = apps/main/backend
TFC_FE   = apps/tfc/frontend
TFC_BE   = apps/tfc/backend
INFRA    = infra

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Main App ──────────────────────────────────────────────

dev: ## Start all main services via Docker Compose (full Docker)
	docker compose -f $(INFRA)/docker-compose.yml up --build

dev-local: ## Start db+api in Docker, Angular natively — best DX, instant HMR
	docker compose -f $(INFRA)/docker-compose.yml up -d db api
	cd $(MAIN_FE) && npx ng serve

dev-backend: ## Start main backend + db only (Docker)
	docker compose -f $(INFRA)/docker-compose.yml up --build api db

dev-frontend: ## Start main Angular dev server natively (expects backend running)
	cd $(MAIN_FE) && npx ng serve

test: test-backend test-frontend ## Run all main app tests

test-backend: ## Run main backend tests
	cd $(MAIN_BE) && python -m pytest -v

test-frontend: ## Run main frontend tests
	cd $(MAIN_FE) && npx ng test --watch=false

# ── TFC App ───────────────────────────────────────────────

dev-tfc: ## Start TFC services via Docker Compose
	docker compose -f $(INFRA)/docker-compose.yml up --build db keycloak tfc-api

dev-tfc-local: ## Start db+tfc-api in Docker, TFC Angular natively
	docker compose -f $(INFRA)/docker-compose.yml up -d db tfc-api
	cd $(TFC_FE) && npx ng serve --port 4201

dev-tfc-frontend: ## Start TFC Angular dev server natively (expects TFC backend running)
	cd $(TFC_FE) && npx ng serve --port 4201

dev-tfc-backend: ## Start TFC backend + db only (Docker)
	docker compose -f $(INFRA)/docker-compose.yml up --build tfc-api db

test-tfc-backend: ## Run TFC backend tests
	cd $(TFC_BE) && python -m pytest -v

test-tfc-frontend: ## Run TFC frontend tests
	cd $(TFC_FE) && npx ng test --watch=false

test-all: test test-tfc-backend test-tfc-frontend ## Run ALL tests (main + TFC)

migrate-tfc: ## Run TFC database migrations
	cd $(TFC_BE) && alembic upgrade head

# ── Shared ────────────────────────────────────────────────

test-scaffold: ## Test the scaffold script
	bash shared/scripts/scaffold_test.sh

generate: generate-map-style ## Extract OpenAPI spec from FastAPI and regenerate frontend client
	cd $(MAIN_BE) && python -m commands.export_openapi
	bash shared/scripts/generate-frontend.sh

generate-map-style: ## Generate Protomaps style.json from design-system tokens
	cd $(MAIN_FE) && node meta/generate-map-style.mjs

lock: ## Regenerate Python lock file (run after changing pyproject.toml)
	cd $(MAIN_BE) && uv lock

migrate: ## Run main database migrations
	cd $(MAIN_BE) && alembic upgrade head

new-feature: ## Scaffold a new feature (usage: make new-feature name=order tier=2 plural=orders)
	bash shared/scripts/scaffold-feature.sh $(name) $(tier) $(plural)

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

setup-hooks: ## Install git hooks (run once after clone)
	cp shared/scripts/pre-push.sh .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
	@echo "Git hooks installed"

lint-arch: ## Run architecture boundary linter
	python shared/scripts/lint-architecture.py

storybook: ## Start Storybook dev server
	cd $(MAIN_FE) && npx storybook dev -p 6006

lint: ## Run all linters
	cd $(MAIN_BE) && ruff check .
	cd $(MAIN_FE) && npx eslint "**/*.{js,ts,html,json}"

verify-tier: ## Verify tier-N build has no higher-tier leaks (usage: make verify-tier TIER=1)
	@rm -rf /tmp/verify-tier-be /tmp/verify-tier-fe
	python shared/scripts/filter-features.py --tier=$(or $(TIER),1) --src=$(MAIN_BE)/features --dest=/tmp/verify-tier-be
	python shared/scripts/filter-features.py --tier=$(or $(TIER),1) --src=$(MAIN_FE)/src/app/features --dest=/tmp/verify-tier-fe --frontend
	python shared/scripts/verify-tier-build.py --tier=$(or $(TIER),1) --backend-dest=/tmp/verify-tier-be --frontend-dest=/tmp/verify-tier-fe
	@rm -rf /tmp/verify-tier-be /tmp/verify-tier-fe

validate: lint-arch lint test ## Validate everything: architecture + linters + tests

security-scan: ## Run security scans and save reports to security-reports/
	bash shared/scripts/security-scan.sh

build: ## Build all services for tier 3 (all features)
	TIER=3 docker compose -f $(INFRA)/docker-compose.yml build

build-tier-1: ## Build for tier 1 (minimal features)
	TIER=1 docker compose -f $(INFRA)/docker-compose.yml build --build-arg TIER=1

build-tier-2: ## Build for tier 2
	TIER=2 docker compose -f $(INFRA)/docker-compose.yml build --build-arg TIER=2

build-tier-3: ## Build for tier 3 (all features)
	TIER=3 docker compose -f $(INFRA)/docker-compose.yml build --build-arg TIER=3

# ── Aider Sessions ───────────────────────────────────────────
# Default config; override with: make aider-fill-in AIDER_CONF=.aider-codestral.conf.yml
AIDER_CONF ?= .aider-glm.conf.yml

aider-fill-in: ## Fill in a scaffolded feature with TDD (step 3 of feature workflow)
	aider --config $(AIDER_CONF) --read prompts/aider/fill-in.md

aider-debug: ## Systematic debugging session
	aider --config $(AIDER_CONF) --read prompts/aider/debug.md

aider-review: ## Review code against project rules
	aider --config $(AIDER_CONF) --read prompts/aider/review.md
