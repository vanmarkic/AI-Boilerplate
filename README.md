# AI Boilerplate

A full-stack monorepo (Angular 21+ / FastAPI / PostgreSQL) architected to maximize productivity with small local LLM coding agents (7B–14B parameters).

> **Philosophy:** The bottleneck for local LLMs is not model quality — it's codebase structure. Files under 250 lines, explicit types, feature-sliced modules, and AGENTS.md convention files reduce context burden enough for a 14B model to make reliable single-file edits.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21+ — standalone components, signals, OnPush |
| Backend | FastAPI — Python 3.12+, async, Pydantic v2 |
| Database | PostgreSQL 17 — SQLAlchemy 2.0, Alembic migrations |
| Contract | OpenAPI 3.1 — single source of truth in `shared/openapi.yaml` |
| UI | Tailwind CSS v4 + design tokens, Angular CDK |
| Testing | Vitest + `@testing-library/angular`, pytest-asyncio |
| Docs | Storybook 8 |
| CI | GitHub Actions — 5 parallel jobs |

## Quick Start

```bash
# Full Docker stack
make dev

# Best DX: DB + API in Docker, Angular natively (instant HMR)
make dev-local

# Run all tests
make test

# Regenerate TypeScript client and Pydantic models from OpenAPI spec
make generate

# Scaffold a new feature (backend + frontend)
make new-feature name=orders tier=2

# Run architecture boundary linter
make lint-arch
```

## Project Structure

```
ai-boilerplate/
├── AGENTS.md                    # Root LLM instructions (~10 rules)
├── Makefile                     # Unified commands
├── docker-compose.yml
├── shared/
│   ├── openapi.yaml             # API contract — modify this first
│   ├── manifest.schema.yaml     # Feature manifest schema
│   └── scripts/
│       ├── generate-backend.sh  # OpenAPI → Pydantic models
│       ├── generate-frontend.sh # OpenAPI → TypeScript client
│       ├── scaffold-feature.sh  # Generate full feature scaffold
│       └── lint-architecture.py # Enforce layer boundaries
├── backend/
│   ├── AGENTS.md                # Backend rules (~30 rules)
│   ├── core/                    # Cross-cutting: config, db, auth, DI
│   ├── features/
│   │   ├── user/                # model, schema, repo, service, router, test, manifest
│   │   └── health/
│   └── main.py
└── frontend/
    ├── AGENTS.md                # Frontend rules (~50 rules)
    └── src/app/
        ├── features/            # Smart feature containers
        │   ├── dashboard/
        │   ├── user-profile/
        │   └── auth/
        └── shared/
            └── ui/              # Dumb primitives — button, badge, card, input
```

## Design Decisions for LLM Agents

### 1. Files ≤ 250 lines

Every file fits in a small model's context window (~3,600 tokens). This is the single most impactful architectural constraint. The MASAI research framework found a **40% improvement** in successful AI-generated fixes when modules were bounded in scope.

### 2. Feature-Sliced Vertical Architecture

Each feature is a self-contained flat folder — no cross-cutting jumps between layers. Backend features have 6 files: `model`, `schema`, `repository`, `service`, `router`, `test`. Frontend features have 5 files: `component`, `service`, `types`, `spec`, `routes`.

### 3. Contract-First (OpenAPI)

`shared/openapi.yaml` is the single source of truth. TypeScript types and Pydantic models are auto-generated from it. The LLM never invents an API shape — it reads the spec and generates conforming code.

### 4. Strict Types Everywhere

TypeScript `strict: true`. Python type hints on all function signatures. Type annotations direct the LLM into the portion of the latent space corresponding to higher code quality, and the compiler provides localized error feedback even small models can act on.

### 5. No Barrel Exports

Direct imports only (`from './user.service'`, not `from '../shared'`). Barrel files expand the dependency graph tools must traverse, wasting tokens on irrelevant re-exports. Removing them also yields dramatically faster builds.

### 6. AGENTS.md at 3 Levels

- Root `AGENTS.md`: ~10 universal rules (stack, architecture, file limits)
- `backend/AGENTS.md`: ~30 FastAPI/SQLAlchemy rules (layer boundaries, DI wiring)
- `frontend/AGENTS.md`: ~50 Angular rules (modern API corrections, signal patterns)

Each level is sized for 7B–14B model capacity (~50–100 instructions max).

### 7. Angular: Correcting Stale Training Data

Small models default to NgModule-era Angular code (pre-v17). The frontend `AGENTS.md` explicitly overrides this with **negative instructions**: no `@Input()`/`@Output()` decorators, no `*ngIf`/`*ngFor`, no `standalone: true` (implicit), always `ChangeDetectionStrategy.OnPush`, always `inject()` over constructor injection.

### 8. Colocated TDD

Tests ship alongside source files (`user_test.py` in the same folder as `user_service.py`). IEEE research shows that including tests with problem statements yields a **12.78% improvement** on code generation benchmarks, and test failures provide structured feedback that small models can act on.

## Recommended Local LLM Setup (24GB VRAM)

| Role | Model | VRAM |
|------|-------|------|
| Chat + edit + agent | GLM-4.7-Flash (RunPod RTX 4090) | ~19 GB |
| Autocomplete | GLM-4.7-Flash (same instance) | shared |
| Embed (RAG) | Nomic Embed Text (local) | ~0.3 GB |

Served via **llama-server** (not Ollama) for correct chat templates and tool-call reliability:

```bash
# On RunPod — one-time setup
bash shared/scripts/setup-llama-server.sh
```

Use **Continue.dev** Agent mode for agentic tasks with tool calls, **Aider** for terminal-based editing, **Claude Code** for orchestration. See [docs/conventions/ai-tooling.md](docs/conventions/ai-tooling.md) for full setup.

## Adding a Feature

```bash
# Scaffold both backend and frontend
make new-feature name=orders tier=2

# Verify no layer boundary violations
make lint-arch

# Regenerate API client after modifying shared/openapi.yaml
make generate
```

Each scaffolded feature includes a `manifest.yaml` describing its capabilities, endpoints, and dependencies — providing 80x context compression for tools that index the repo.

## License

MIT
