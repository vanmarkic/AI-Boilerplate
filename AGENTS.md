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
