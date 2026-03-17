# AI Boilerplate

A full-stack monorepo (Angular 21 / FastAPI / PostgreSQL) architected to maximize productivity with small local LLM coding agents (7B–14B parameters).

> **Philosophy:** The bottleneck for local LLMs is not model quality — it's codebase structure. Files under 250 lines, explicit types, feature-sliced modules, and AGENTS.md convention files reduce context burden enough for a 14B model to make reliable single-file edits.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21 — zoneless, signals, standalone components |
| Backend | FastAPI — Python 3.12+, async, Pydantic v2 |
| Database | PostgreSQL 17 — SQLAlchemy 2.0 (async), Alembic migrations |
| Auth | Keycloak — OIDC, JWT validation via PyJWT |
| Contract | OpenAPI 3.1 — code-first from FastAPI, TypeScript client via `@hey-api/openapi-ts` |
| Design System | Framework-agnostic CSS package (`@aspect/design-system`) — OKLCH tokens, CSS layers, native nesting |
| UI Components | `@aspect/ui` — Angular component library (symlinked into frontend) |
| State | `@ngrx/signals` |
| Testing | Vitest (frontend), pytest-asyncio (backend), Playwright (E2E) |
| Docs | Storybook 10 + `@storybook/angular` |
| CI | GitHub Actions — architecture lint, backend tests, frontend lint/test/build/E2E, Storybook deploy |

## Quick Start

```bash
# Main app (db + keycloak + api + frontend)
make dev

# TFC app (db + tfc-api)
make dev-tfc

# Both apps together
make dev-all

# Best DX: DB + API in Docker, Angular natively (instant HMR)
make dev-local

# Run all tests
make test

# Extract OpenAPI spec from FastAPI and regenerate TypeScript client
make generate

# Scaffold a new feature (backend + frontend)
make new-feature name=orders tier=2

# Run architecture boundary linter
make lint-arch

# Storybook
cd frontend
npm run storybook         # dev server on :6006
npm run build-storybook   # static build
```

## Project Structure

```
ai-boilerplate/
├── CLAUDE.md                        # Claude Code project instructions
├── AGENTS.md                        # Root LLM instructions (~10 rules)
├── SPECS.md                         # Product specification (domain, business rules)
├── SPECS.template.md                # Blank template for new projects
├── Makefile                         # Unified commands
├── infra/
│   ├── docker-compose.yml           # shared infra (db + keycloak)
│   ├── docker-compose.main.yml      # main app (api + frontend)
│   └── docker-compose.tfc.yml       # tfc app (tfc-api)
├── package.json                     # npm workspaces root
│
├── packages/
│   ├── design-system/               # Framework-agnostic CSS design system
│   │   ├── tokens.css               #   :root custom properties (OKLCH, 4px grid)
│   │   ├── reset.css                #   minimal reset
│   │   ├── utilities.css            #   single-responsibility utility classes
│   │   └── components.css           #   component styles with data-* selectors
│   ├── ui/                          # @aspect/ui — Angular component library
│   │   └── src/                     #   button, badge, card, input, dialog-panel, etc.
│   ├── ng-feature-flags/            # @aspect/ng-feature-flags — Angular feature flag guard + service
│   ├── ngrx-with-resource/          # @aspect/ngrx-with-resource — withResource() for NgRx Signal Store
│   ├── monorepo-tier-filter/        # Python: filter features by tier for Docker builds
│   ├── python-layer-lint/           # Python: layer boundary linter
│   └── security-scan/               # Shell: Trivy + npm audit wrapper
│
├── frontend/                        # Angular 21 (zoneless, signals, standalone)
│   └── src/app/
│       ├── core/                    #   environment, error handling
│       ├── features/                #   smart feature containers
│       │   ├── admin-permissions/
│       │   ├── auth/
│       │   ├── canary/
│       │   ├── dashboard/
│       │   ├── landing/
│       │   ├── register/
│       │   ├── user-profile/
│       │   └── weather/
│       └── shared/ui/ → packages/ui/src  # symlink to @aspect/ui source
│
├── backend/                         # FastAPI + async SQLAlchemy
│   ├── core/                        #   config, database, auth, middleware, DI
│   ├── features/
│   │   ├── admin_permissions/
│   │   ├── admin_users/
│   │   ├── canary/
│   │   ├── health/
│   │   ├── user/
│   │   └── weather/
│   ├── alembic/                     #   database migrations
│   └── main.py
│
├── keycloak/                        # Keycloak config + realm export
├── security-reports/                # Committed Trivy/npm audit reports
├── shared/
│   ├── manifest.schema.yaml         # Feature manifest schema
│   └── scripts/                     # generate-frontend.sh, scaffold-feature.sh, lint-architecture.py
├── docs/                            # Conventions and plans
└── prompts/                         # Aider session prompts
```

## CSS Architecture

**`packages/design-system/`** is the single source of truth for all CSS. No Tailwind, no preprocessors.

Consumed via `@import "@aspect/design-system"` in the frontend, layered as:

```css
@layer reset, tokens, utilities, components;
```

Components use `data-*` HTML attributes for variants, styled via CSS attribute selectors:
```html
<button uiButton variant="destructive" size="lg">Delete</button>
```
```css
[uiButton][data-variant="destructive"] { background-color: var(--color-destructive); }
```

## Design Decisions for LLM Agents

1. **Files ≤ 250 lines** — fits in a small model's context window (~3,600 tokens)
2. **Feature-sliced vertical architecture** — self-contained flat folders, no cross-cutting jumps
3. **Code-first API (OpenAPI)** — FastAPI routers are the single source of truth; `make generate` regenerates the TS client
4. **Strict types everywhere** — TypeScript `strict: true`, Python type hints on all signatures
5. **No barrel exports** — direct imports only, faster builds, less token waste
6. **AGENTS.md at 3 levels** — root (~16 rules), backend (~31), frontend (~50+)
7. **Angular: correcting stale training data** — explicit overrides for modern Angular patterns (signals, `inject()`, no NgModules)
8. **Colocated TDD** — tests ship alongside source files

## CI / CD

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | push/PR to `main` | Architecture lint, backend tests, frontend tests, code lint, OpenAPI validation |
| `frontend-ci.yml` | push/PR to `master` (frontend paths) | Lint, unit tests, build, E2E (Playwright) |
| `deploy-storybook.yml` | push to `main` (frontend/design-system paths) | Build Storybook → deploy to GitHub Pages |
| `security.yml` | push/PR + weekly schedule | Trivy container/filesystem scan, npm audit, CodeQL analysis |
| `security-reports.yml` | weekly schedule | Generate and commit security scan reports to `security-reports/` |

## Adding a Feature

```bash
make new-feature name=orders tier=2   # scaffold backend + frontend
make lint-arch                        # verify no layer boundary violations
make generate                         # regenerate TypeScript client from OpenAPI
```

Each scaffolded feature includes a `manifest.yaml` describing its capabilities, endpoints, and dependencies. Add `business_rules` to the manifest and update `SPECS.md` with the domain context.

## License

MIT
