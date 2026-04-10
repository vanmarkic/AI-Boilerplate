# AI Boilerplate

## First Steps
Before writing any code:
1. Determine which app you are working on: `apps/main/` or `apps/tfc/`.
2. Read the app-level AGENTS.md: `apps/main/AGENTS.md` or `apps/tfc/AGENTS.md`.
3. Read the relevant subdirectory AGENTS.md for the layer: `backend/AGENTS.md` for backend work, `frontend/AGENTS.md` for frontend work.

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
1. Every feature is a flat folder under `features/`.
4. API contract is code-first: define Pydantic models + FastAPI routers, then run `make generate` to extract the spec and regenerate the TypeScript client.
5. Tests colocated with source files. Write failing test before implementation.
6. Use strict TypeScript (`strict: true`). Use Python type hints on all functions.
7. No `any` type in TypeScript. No untyped function signatures in Python.
8. Auth uses Keycloak (OIDC + JWT). Backend validates tokens via `core/auth.py`. Do not bypass or stub out auth.
9. Each feature has a `manifest.yaml` describing its capabilities and dependencies.
10. Run `make validate` before committing (runs architecture linter + all linters + all tests).

## Common Pitfalls
- Do NOT write CSS in Angular component `styles` arrays — add styles to `packages/design-system/components.css` instead.
- Do NOT hardcode colors, spacing, or font sizes — use design tokens (`var(--color-primary)`, `var(--spacing-md)`, etc.).
- Do NOT create a feature without a `manifest.yaml`.
- Do NOT modify the database schema without an Alembic migration.
- Do NOT use `any` in TypeScript or untyped signatures in Python.
- Do NOT bypass Keycloak auth — all protected endpoints must use `Depends(get_current_user)`.
- Do NOT use `app-` prefix for UI component selectors — use `ui-` prefix (e.g., `ui-button`, `ui-card`). Button directive selector is `uiButton`.
- Do NOT add app-specific or domain-specific components to `packages/ui/`. The shared UI library is for generic building blocks only. If a component is only meaningful within a single app (e.g., an exercise-specific panel), it belongs in that app's `features/` folder.
- When using gh CLI, always pass `-R vanmarkic/AI-Boilerplate` explicitly.

## LLM Context Scoping
- TFC and main app share NO backend/frontend code — they are independent apps.
- **Before starting work, run the appropriate `make context-*` target based on the task scope.** If the scope is unclear, ask the user.
- Available scopes:
  - `context-tfc` / `context-main` — full app (frontend + backend)
  - `context-tfc-fe` / `context-main-fe` — frontend only (pure GUI work)
  - `context-tfc-be` / `context-main-be` — backend only
  - `context-all` — full monorepo
- Append `SLIM=1` to also exclude tests and e2e (e.g. `make context-tfc-fe SLIM=1`).
- Shared packages (`packages/`) are always visible regardless of context scope.
- `.claudeignore` is gitignored — each developer sets their own scope.

## Entire CLI (AI Session Recording)
Entire captures AI agent sessions (transcripts, prompts, token usage, tool calls) alongside git commits. Checkpoints are created on every git commit and stored on a separate `entire/checkpoints/v1` branch — your active branch stays clean.

### How it works
1. Hooks in `.claude/settings.json` capture session data as you work — do NOT remove or modify the `entire hooks` entries.
2. Checkpoints are created automatically when a git commit is made.
3. Entire never creates commits on your active branch.
4. Do NOT read or write to `.entire/metadata/` or `.entire/tmp/`.

### Workflow
- `entire status` — check if a session is active and see current session info.
- `entire explain` — show the full AI conversation (prompts, responses, files touched) behind a commit or session. Use when the user asks about reasoning behind changes, or when you need context from prior sessions.
- `entire resume <branch>` — checkout a branch and restore its latest session metadata. Use when switching to a branch that had previous AI work.
- `entire rewind` — restore files to a mid-session checkpoint (interactive — let the user run this).
- `entire doctor` — diagnose and fix stuck sessions or desynchronized state.

### When Claude should use Entire
- **Starting work on an existing branch**: run `entire status` to check for active sessions.
- **User asks "why was this done?"**: run `entire explain` to retrieve the AI reasoning behind commits.
- **User switches branches with prior AI work**: run `entire resume <branch>` to restore context.
- **Something looks broken**: run `entire doctor` to troubleshoot.

## Meta
- See `docs/conventions/agents-authoring-guide.md` for rules on writing and maintaining AGENTS.md and manifest.yaml files.
- Do NOT edit `CLAUDE.md` — it is a read-only entry point that loads this file into Claude Code's context.
