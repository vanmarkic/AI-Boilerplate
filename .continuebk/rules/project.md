---
name: Project Rules
description: AI Boilerplate project conventions and architecture rules
globs: "**/*"
alwaysApply: true
---

# AI Boilerplate — Project Rules

## Stack
- Frontend: Angular 18+ standalone components, signals, Tailwind CSS v4
- Backend: FastAPI Python 3.12+, SQLAlchemy 2.0 async, Alembic, PostgreSQL 17
- Contract: OpenAPI 3.1 at `shared/openapi.yaml` — **modify spec first, then implement**

## Universal Rules
1. Maximum **250 lines per file**. Split if exceeded (150 for Angular UI primitives).
2. No barrel exports (`index.ts` re-exports). Use direct imports only.
3. Every feature is a **flat folder** under `features/`.
4. **OpenAPI contract first**: edit `shared/openapi.yaml` before writing any backend or frontend code.
5. **Tests colocated** with source. Write failing test before implementation (TDD).
6. Strict TypeScript (`strict: true`). Python: type hints on ALL function signatures.
7. No `any` in TypeScript. No untyped Python functions.
8. Auth is a stub — **never implement real authentication logic**.
9. Every feature has a `manifest.yaml` with a `tier: 1|2|3` field.
10. Run `make lint-arch` before committing to check layer boundary violations.

## Feature Tiering
- Tier 1 = base features in all builds
- Features must NOT import from a higher tier
- Scaffold new features: `make new-feature name=<name> tier=<N>`
- Runtime flags in `core/feature_flags.py` + `feature-flag.service.ts`

---

## Backend Rules (FastAPI)

### Layer Import Order (strictly enforced)
```
router → service → repository → model/schema
```
- `router`: imports service, schema, core
- `service`: imports repository, model, schema, core
- `repository`: imports model, core
- `model`: imports core only (SQLAlchemy Base)
- `schema`: imports stdlib only (Pydantic)
- **NEVER import from a higher layer**

### File Conventions
- Underscore naming: `user_model.py`, `user_service.py`, `user_router.py`
- Feature folder files: `model`, `schema`, `repository`, `service`, `router`, `test`, `manifest.yaml`
- All routers mounted in `main.py` via `app.include_router()`
- Use `Depends()` for DI — wire in `core/dependencies.py`
- All endpoints return Pydantic response models
- Use `status.HTTP_XXX` constants, never raw integers
- Prefix all routes with `/api/`

### SQLAlchemy 2.0
- Use `Mapped[]` type annotations for all columns
- Use `mapped_column()` for column definitions
- All models inherit from `core.database.Base`
- Use `AsyncSession` — never sync sessions

### Pydantic
- All request/response bodies are `BaseModel` subclasses
- Use `model_config = {"from_attributes": True}` for ORM models
- Use `EmailStr` for email fields

### Testing
- Colocated as `feature_test.py`
- `pytest` + `pytest-asyncio` (`asyncio_mode = "auto"`)
- `httpx.AsyncClient` with `ASGITransport` for integration tests
- Override `get_session` dependency for test DB isolation

### Migrations
- Alembic for ALL schema changes — never modify DB manually
- Import all models in `alembic/env.py` for autogenerate

---

## Frontend Rules (Angular 18+)

### NEVER generate
- No NgModules — all components are standalone
- Do NOT write `standalone: true` — it is the default, omit it
- No `@Input()` or `@Output()` decorators
- No `*ngIf`, `*ngFor`, `*ngSwitch`
- No `ngClass` or `ngStyle`
- No `@HostBinding` or `@HostListener`
- No constructor injection
- No `BehaviorSubject` for local state

### ALWAYS generate
- `input()` and `output()` signal functions for component IO
- `signal()`, `computed()`, `effect()` for state
- `@if`, `@for`, `@switch` (native Angular 17+ control flow)
- Native `[class]` and `[style]` bindings
- `host: {}` in `@Component` decorator for host bindings
- `inject()` for dependency injection
- `changeDetection: ChangeDetectionStrategy.OnPush` always

### Component Architecture
- **UI Primitives** (`shared/ui/`): inline template, single `.ts`, ≤150 lines, no `inject()`, pure input/output, OnPush, colocated `.stories.ts`
- **Feature Components** (`features/`): wire services, can use `inject()`, lazy-loaded
- Variants: `computed()` + `Record<string, string>` maps
- Use `cn()` from `shared/utils.ts` for class merging

### Styling (Tailwind v4)
- Semantic tokens only: `bg-primary`, `text-foreground`, `border-border`
- **NEVER** arbitrary values like `bg-[#3B82F6]`
- Spacing via token scale: `p-xs`, `p-sm`, `p-md`, `p-lg`, `p-xl`
- Base classes via `host: { 'class': '...' }` in `@Component`
- Component-scoped styles only for animations or pseudo-elements

### Routing & HTTP
- Each feature exports a `FEATURE_ROUTES` constant
- Top-level: `loadChildren()` for lazy loading
- Auth-protected: `canActivate: [authGuard]`
- API calls through services with signal state, use `firstValueFrom()`
- Base URL in `core/environment.ts`, auth token via `shared/auth/auth.interceptor.ts`
