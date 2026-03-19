# AI Boilerplate

## First Steps
Before writing any code:
1. Check if `SPECS.md` exists and is filled in. If it is empty or missing, ask the user questions to gather the required information (domain, users, business rules, API endpoints) and fill in `SPECS.md` on their behalf before writing any code.
2. Read the relevant subdirectory AGENTS.md for the area you are working in: `frontend/AGENTS.md` for frontend work, `backend/AGENTS.md` for backend work.

`SPECS.md` describes WHAT the software does (domain, business rules, glossary).
This file describes HOW to write code (conventions, architecture, constraints).

## Stack
- Frontend: Angular 21+ (standalone components, signals, zoneless)
- Backend: FastAPI (Python 3.12+)
- Database: PostgreSQL 17 (SQLAlchemy 2.0 + Alembic)
- Auth: Keycloak (OIDC, JWT validation via PyJWT)
- Contract: OpenAPI 3.1 (code-first — generated from FastAPI routers via `make generate`)
- Design System: `@aspect/design-system` — framework-agnostic CSS (OKLCH tokens, CSS layers, no Tailwind)
- UI Components: `@aspect/ui` — Angular component library (`packages/ui/`, symlinked at `frontend/src/app/shared/ui/`). **Must contain only generic, reusable building blocks** (buttons, cards, dialogs, inputs, layout primitives). App-specific or domain-specific components belong in the app's own `features/` folder, not in `packages/ui/`.

## Architecture
Feature-sliced pragmatic DDD monorepo. Each feature is a self-contained folder.

## Universal Rules
1. Maximum 350 lines per file (500 for test files). Split if exceeded.
2. No barrel exports (index.ts re-exports). Use direct imports.
3. Every feature is a flat folder under `features/`.
4. API contract is code-first: define Pydantic models + FastAPI routers, then run `make generate` to extract the spec and regenerate the TypeScript client.
5. Tests colocated with source files. Write failing test before implementation.
6. Use strict TypeScript (`strict: true`). Use Python type hints on all functions.
7. No `any` type in TypeScript. No untyped function signatures in Python.
8. Auth uses Keycloak (OIDC + JWT). Backend validates tokens via `core/auth.py`. Do not bypass or stub out auth.
9. Each feature has a `manifest.yaml` describing its capabilities and dependencies.
10. Run `make validate` before committing (runs architecture linter + all linters + all tests).

## Feature Tiering
11. Every feature MUST have a `tier` field in its `manifest.yaml` (1, 2, or 3).
12. Tier 1 = base features included in all builds.
13. Features must NOT import from a higher tier (tier-1 cannot import tier-2 code).
14. Use `make build-tier-N` to build Docker images for a specific tier.
15. Runtime feature flags (`core/feature_flags.py`, `feature-flag.service.ts`) toggle features WITHIN the shipped tier.
16. Scaffold new features with tier: `make new-feature name=analytics tier=2`.

## Feature Workflow

**STOP — Do NOT create feature files manually.** Always use the scaffold script first.

```
make spec name=<name> tier=<N>        # 1. Generate SPECS.md section template, fill it in
make new-feature name=<name> tier=<N> # 2. Generates 12+ skeleton files (backend + frontend)
                                       # 3. Fill in the TODO markers in the generated files
make generate                          # 4. Extract OpenAPI spec, regenerate TypeScript client
make validate                          # 5. Run all linters + tests
git commit                             # 6. Commit
```

Router registration and dependency wiring are automatic — no manual edits to `main.py` or `dependencies.py` needed. See `docs/conventions/feature-workflow.md` for full details.

## Common Pitfalls
- Do NOT create feature files manually — always run `make new-feature name=<name> tier=<N>` first.
- Do NOT write CSS in Angular component `styles` arrays or `frontend/src/styles/` — add styles to `packages/design-system/components.css` instead.
- Do NOT hardcode colors, spacing, or font sizes — use design tokens (`var(--color-primary)`, `var(--spacing-md)`, etc.).
- Do NOT import across tiers (tier-1 code must not import from tier-2 or tier-3).
- Do NOT create a feature without a `manifest.yaml`.
- Do NOT use barrel exports (`index.ts` re-exports).
- Do NOT modify the database schema without an Alembic migration.
- Do NOT use `any` in TypeScript or untyped signatures in Python.
- Do NOT bypass Keycloak auth — all protected endpoints must use `Depends(get_current_user)`.
- Do NOT use `app-` prefix for UI component selectors — use `ui-` prefix (e.g., `ui-button`, `ui-card`). Button directive selector is `uiButton`.
- Do NOT add app-specific or domain-specific components to `packages/ui/`. The shared UI library is for generic building blocks only. If a component is only meaningful within a single app (e.g., an exercise-specific panel), it belongs in that app's `features/` folder.
- Do NOT edit generated API client files in `frontend/src/app/shared/api/generated/` — run `make generate` instead.
- When using gh CLI, always pass `-R vanmarkic/AI-Boilerplate` explicitly.

## Meta
- See `docs/conventions/agents-authoring-guide.md` for rules on writing and maintaining AGENTS.md and manifest.yaml files.
- Do NOT edit `CLAUDE.md` — it is a read-only entry point that loads this file into Claude Code's context.
