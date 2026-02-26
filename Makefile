.PHONY: dev test test-backend test-frontend generate migrate new-feature lint-arch lint storybook help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services via Docker Compose
	docker compose up --build

dev-backend: ## Start backend + db only
	docker compose up --build api db

dev-frontend: ## Start frontend only (expects backend running)
	cd frontend && ng serve

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
