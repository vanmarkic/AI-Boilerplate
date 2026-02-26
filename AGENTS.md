# AI Boilerplate

## Stack
- Frontend: Angular 18+ (standalone components, signals)
- Backend: FastAPI (Python 3.12+)
- Database: PostgreSQL 17 (SQLAlchemy 2.0 + Alembic)
- Contract: OpenAPI 3.1 (shared/openapi.yaml)

## Architecture
Feature-sliced pragmatic DDD monorepo. Each feature is a self-contained folder.

## Universal Rules
1. Maximum 250 lines per file. Split if exceeded.
2. No barrel exports (index.ts re-exports). Use direct imports.
3. Every feature is a flat folder under `features/`.
4. API contract lives in `shared/openapi.yaml`. Modify spec first, then implement.
5. Tests colocated with source files. Write failing test before implementation.
6. Use strict TypeScript (`strict: true`). Use Python type hints on all functions.
7. No `any` type in TypeScript. No untyped function signatures in Python.
8. Auth is a stub — do not implement real authentication logic.
9. Each feature has a `manifest.yaml` describing its capabilities and dependencies.
10. Run `make lint-arch` before committing to check layer boundary violations.

## Feature Tiering
11. Every feature MUST have a `tier` field in its `manifest.yaml` (1, 2, or 3).
12. Tier 1 = base features included in all builds.
13. Features must NOT import from a higher tier (tier-1 cannot import tier-2 code).
14. Use `make build-tier-N` to build Docker images for a specific tier.
15. Runtime feature flags (`core/feature_flags.py`, `feature-flag.service.ts`) toggle features WITHIN the shipped tier.
16. Scaffold new features with tier: `make new-feature name=analytics tier=2`.
