# AI-Optimized Full-Stack Boilerplate Design

**Date**: 2026-02-26
**Stack**: Angular / FastAPI / PostgreSQL
**Purpose**: Personal productivity boilerplate optimized for small local LLM coding agents (7B-14B)

---

## Design Principles

1. **Files under 250 lines** — every file fits in a small LLM's context window
2. **Feature-sliced vertical architecture** — self-contained modules, no cross-cutting jumps
3. **Contract-first (OpenAPI)** — single source of truth, auto-generated types
4. **Strict types everywhere** — TypeScript strict mode, Python type hints on all functions
5. **No barrel exports** — direct imports only, traceable paths
6. **Colocated TDD** — failing tests ship with every scaffold
7. **AGENTS.md convention files** — ~70 rules across 3 levels, within 14B model capacity
8. **Metadata-rich features** — manifest.yaml per feature for 80x context compression
9. **Automated governance** — architecture linter enforces layer boundaries in CI

---

## Monorepo Structure

```
ai-boilerplate/
├── AGENTS.md                    # Root-level LLM instructions (~10 rules)
├── docker-compose.yml           # FastAPI + PostgreSQL + Angular dev
├── Makefile                     # Unified commands
├── .github/
│   └── workflows/
│       └── ci.yml               # 5 parallel CI jobs
├── shared/
│   ├── openapi.yaml             # API contract (single source of truth)
│   └── scripts/
│       ├── generate-backend.sh  # OpenAPI → Pydantic models
│       ├── generate-frontend.sh # OpenAPI → TypeScript client + types
│       ├── scaffold-feature.sh  # Generate new feature (backend + frontend)
│       └── lint-architecture.py # Enforce layer boundaries
├── backend/
│   ├── AGENTS.md                # Backend-specific rules (~30 rules)
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/                 # DB migrations
│   ├── core/                    # Cross-cutting concerns
│   │   ├── config.py            # Pydantic Settings from env vars
│   │   ├── database.py          # AsyncSession factory, Base model
│   │   ├── auth.py              # Auth STUB (swap in Keycloak/JWT)
│   │   ├── dependencies.py      # FastAPI DI wiring
│   │   └── middleware.py        # CORS, error handling, request ID
│   ├── features/                # Feature-sliced modules
│   │   ├── user/
│   │   │   ├── user.model.py
│   │   │   ├── user.schema.py
│   │   │   ├── user.repository.py
│   │   │   ├── user.service.py
│   │   │   ├── user.router.py
│   │   │   ├── user.test.py
│   │   │   └── manifest.yaml
│   │   └── health/
│   │       ├── health.router.py
│   │       └── health.test.py
│   ├── generated/               # Auto-gen from OpenAPI (read-only)
│   ├── main.py                  # App factory
│   └── conftest.py              # Pytest fixtures
├── frontend/
│   ├── AGENTS.md                # Frontend-specific rules (~50 rules)
│   ├── Dockerfile
│   ├── angular.json
│   ├── tsconfig.json            # strict: true
│   ├── .storybook/              # Storybook config
│   │   ├── main.ts
│   │   └── preview.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app/
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   ├── features/
│   │   │   │   ├── user-profile/
│   │   │   │   │   ├── user-profile.component.ts
│   │   │   │   │   ├── user-profile.service.ts
│   │   │   │   │   ├── user-profile.types.ts
│   │   │   │   │   ├── user-profile.component.spec.ts
│   │   │   │   │   └── user-profile.routes.ts
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── (same pattern)
│   │   │   │   └── auth/
│   │   │   │       ├── login.component.ts
│   │   │   │       ├── login.component.spec.ts
│   │   │   │       └── auth.routes.ts
│   │   │   ├── shared/
│   │   │   │   ├── ui/
│   │   │   │   │   ├── button.component.ts
│   │   │   │   │   ├── button.stories.ts    # Storybook story
│   │   │   │   │   ├── input.component.ts
│   │   │   │   │   ├── input.stories.ts
│   │   │   │   │   ├── badge.component.ts
│   │   │   │   │   ├── card.component.ts
│   │   │   │   │   └── form-field.component.ts
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.service.ts    # Token storage stub
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   └── auth.interceptor.ts
│   │   │   │   ├── api/
│   │   │   │   │   └── api-client.generated.ts  # Auto-gen (read-only)
│   │   │   │   └── utils.ts               # cn() class merging utility
│   │   │   └── core/
│   │   │       ├── environment.ts
│   │   │       └── error-handler.ts
│   │   └── styles/
│   │       ├── tokens.css               # Design tokens via @theme
│   │       └── styles.css               # Global + Tailwind import
│   └── e2e/
└── docs/
    └── plans/
```

---

## Backend Architecture (FastAPI + Pragmatic DDD)

### Feature Module Pattern (6 files per feature, all under 250 lines)

| File | Responsibility | Imports from |
|------|---------------|-------------|
| `feature.model.py` | SQLAlchemy 2.0 entity | `core.database` only |
| `feature.schema.py` | Pydantic request/response DTOs | stdlib only |
| `feature.repository.py` | DB queries (async SQLAlchemy) | `model`, `core.database` |
| `feature.service.py` | Business logic | `repository`, `model`, `schema` |
| `feature.router.py` | FastAPI endpoints | `service`, `schema`, `core.auth` |
| `feature.test.py` | Colocated unit tests (TDD) | all feature files |

### Dependency Flow (strictly enforced by linter)

```
router → service → repository → model
  ↓         ↓          ↓          ↓
schema    schema    database    SQLAlchemy Base
```

### Auth Stub Pattern

```python
# core/auth.py
@dataclass
class CurrentUser:
    id: str
    email: str
    roles: list[str]

async def get_current_user() -> CurrentUser:
    """STUB: Replace with Keycloak/JWT/OAuth2"""
    return CurrentUser(id="stub-1", email="dev@local", roles=["admin"])
```

Endpoints use: `user: CurrentUser = Depends(get_current_user)`

### Database

- SQLAlchemy 2.0 with `Mapped[]` typed columns
- AsyncSession via `asyncpg`
- Alembic for migrations
- Repository pattern wrapping SQLAlchemy queries

---

## Frontend Architecture (Angular 18+ Standalone + Signals + Tailwind + Storybook)

### Styling: Tailwind v4 + Design Tokens

- **Tailwind CSS v4** with `@theme` directive for semantic design tokens
- All colors, spacing, radius defined as tokens — LLMs use semantic names (`bg-primary`, not `#3b82f6`)
- Dark mode via token switching (`.dark` class overrides)
- `cn()` utility (tailwind-merge + clsx) for class merging

### Component Architecture

- **UI primitives** (`shared/ui/`): Inline templates, ≤150 lines, no services, `OnPush`
- **Feature components** (`features/`): Wire services to UI primitives
- **Variant pattern**: `computed()` + `Record<VariantValue, string>` maps (no cva library)
- **Angular CDK** for headless behavior (overlays, a11y, drag-drop)
- **Storybook** for visual component development — each UI component gets `.stories.ts`

### Feature Module Pattern (5-6 files per feature)

| File | Responsibility |
|------|---------------|
| `feature.component.ts` | Standalone component + template (OnPush) |
| `feature.service.ts` | HttpClient + signal state |
| `feature.types.ts` | TypeScript interfaces |
| `feature.component.spec.ts` | TDD tests (failing) |
| `feature.routes.ts` | Child route config |
| `feature.stories.ts` | Storybook stories (for UI components) |

### Key Patterns

- **Signals for state** — `signal()`, `computed()`, no BehaviorSubject/NgRx
- **Standalone components** — no NgModules, don't set `standalone: true` (it's default)
- **`@if`/`@for` control flow** — native syntax, NEVER `*ngIf`/`*ngFor`
- **`input()`/`output()` functions** — NEVER `@Input()`/`@Output()` decorators
- **`inject()` function** — NEVER constructor injection
- **`ChangeDetectionStrategy.OnPush`** — on EVERY component
- **Lazy-loaded routes** — each feature loaded independently
- **Direct imports** — no barrel exports (except `shared/ui/` public API)
- **Inline templates** for components ≤30 lines of template

### Stale Knowledge Corrections (critical for small LLMs)

AGENTS.md must explicitly list what NOT to generate:
- Do NOT use NgModules
- Do NOT use `@Input()`/`@Output()` decorators
- Do NOT use `*ngIf`/`*ngFor`/`*ngSwitch`
- Do NOT use `ngClass`/`ngStyle`
- Do NOT use `@HostBinding`/`@HostListener`
- Do NOT use constructor injection

### Auth Stub (Frontend)

- `auth.service.ts` — stores/retrieves mock token
- `auth.guard.ts` — route protection via `canActivate`
- `auth.interceptor.ts` — attaches token to HTTP requests

### Design Tokens

```css
@theme {
  --color-primary: oklch(59.59% 0.24 255);
  --color-primary-foreground: oklch(98% 0.01 255);
  --color-destructive: oklch(57% 0.24 27);
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14% 0.004 286);
  --color-border: oklch(90% 0.01 286);
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}
```

---

## API Contract (OpenAPI 3.1)

- Defined in `shared/openapi.yaml` — single source of truth
- Backend: `datamodel-code-generator` generates Pydantic models
- Frontend: `@hey-api/openapi-ts` generates TypeScript client + types
- Both output to `generated/` directories
- OpenAPI spec validated in CI via `@redocly/cli`

---

## Feature Metadata (manifest.yaml)

Each feature includes a `manifest.yaml` for machine-readable discovery:

```yaml
name: user
tier: 1                    # Feature tier (1, 2, or 3)
description: User registration and profile management
version: 0.1.0
dependencies:
  internal: []
  external: [postgresql]
api_endpoints:
  - POST /api/users
  - GET /api/users/{id}
models: [User]
events_emitted: []
events_consumed: []
```

~200 tokens vs ~16K tokens for full feature files = 80x context compression.

---

## Feature Tiering & Commercial IP Protection

### Dual-Layer Architecture

1. **Build-time exclusion** (hard boundary) — `filter-features.py` reads `tier` from each manifest and copies only features ≤ target tier into the Docker image. Unpaid feature source code is physically absent from the artifact.

2. **Runtime feature flags** (soft boundary) — `FeatureFlags` service toggles features within the shipped tier. For A/B testing, gradual rollouts, per-tenant configuration.

### Build Commands

| Command | Result |
|---------|--------|
| `make build-tier-1` | Docker image with tier-1 features only |
| `make build-tier-2` | Docker image with tier-1 + tier-2 features |
| `make build-tier-3` | Docker image with all features |

### Tier Boundary Rules

- Features must NOT import from a higher tier (tier-1 cannot import tier-2 code)
- Architecture linter enforces tier boundaries alongside layer boundaries
- Scaffold with tier: `make new-feature name=analytics tier=2`

---

## Infrastructure

### Docker Compose

- `api` — FastAPI on port 8000 (hot reload via volume mount)
- `db` — PostgreSQL 17 on port 5432
- `frontend` — Angular dev server on port 4200

### Makefile Commands

| Command | Action |
|---------|--------|
| `make dev` | Start all services |
| `make test` | Run all tests (backend + frontend) |
| `make test-backend` | pytest |
| `make test-frontend` | ng test |
| `make generate` | Regenerate types from OpenAPI |
| `make migrate` | Run Alembic migrations |
| `make new-feature name=X` | Scaffold new feature |
| `make lint-arch` | Run architecture linter |

---

## CI/CD (GitHub Actions)

5 parallel jobs:

1. **Architecture lint** — `lint-architecture.py` enforces import rules
2. **Backend tests** — pytest against real PostgreSQL service
3. **Frontend tests** — Angular tests in headless Chrome
4. **Code lint** — Ruff (Python) + ESLint (Angular)
5. **OpenAPI validation** — Redocly validates the spec

---

## Testing Strategy (Full TDD Scaffold)

- All scaffolded features ship with **failing tests**
- Backend: pytest + pytest-asyncio + httpx TestClient
- Frontend: Jest/Vitest + Angular Testing Library
- Tests colocated with source (not in separate test/ tree)
- One example test per layer demonstrates the TDD workflow

---

## AGENTS.md Convention Files

Three levels, ~70 total rules:

- **Root AGENTS.md** (~10 rules): Stack, architecture pattern, universal rules
- **Backend AGENTS.md** (~30 rules): Python/FastAPI conventions, layer rules, testing
- **Frontend AGENTS.md** (~30 rules): Angular conventions, signal patterns, testing

---

## References

- [Architecting codebases for small local LLM coding agents](user-provided article)
- [clean-boilerplate-26](https://github.com/vanmarkic/clean-boilerplate-26)
- [Mastering Software Architecture for the AI Era](https://medium.com/software-architecture-in-the-age-of-ai/the-shift-has-begun-why-software-architecture-needs-to-change-for-ai-d84e73a1cdf8)
- [From Intent to Execution — Designing Systems AI Can Navigate](https://medium.com/software-architecture-in-the-age-of-ai/from-intent-to-execution-designing-systems-ai-can-navigate-ef015117f11b)
- [From Monoliths to Composability](https://medium.com/software-architecture-in-the-age-of-ai/from-monoliths-to-composability-aligning-architecture-with-ais-modularity-55914fc86b16)
