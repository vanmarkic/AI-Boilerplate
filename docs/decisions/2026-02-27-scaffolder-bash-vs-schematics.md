# ADR: Bash Scaffolder vs Angular CLI Schematics

**Date**: 2026-02-27
**Status**: Accepted
**Decision**: Keep the pure-bash scaffolder as the primary code generator

---

## Context

The boilerplate needs a single command that generates a full vertical slice — backend model, repository, service, router, and frontend component, service, and routes — from one feature name. Two options were evaluated:

1. **Pure bash + heredoc templates** (current approach)
2. **Angular CLI schematics** (`ng generate`) plus a separate backend generator

---

## Bash Scaffolder — Pros

| # | Pro | Detail |
|---|-----|--------|
| 1 | Zero dependencies | Works on any machine with bash; no `@angular/cli` or Node required to scaffold |
| 2 | Full transparency | Every line of output is visible in one ~250-line file; nothing hidden behind schematic abstractions |
| 3 | LLM-friendly | An AI agent can read the script and understand exactly what gets generated, supporting the project goal of 7B-14B model compatibility |
| 4 | Unified cross-stack generation | One script handles both backend (Python) and frontend (TypeScript) in a single pass; `ng generate` only covers Angular |
| 5 | Consistent naming conventions | The bash script controls all four name variants (snake, kebab, PascalCase, plural) from one place, keeping backend and frontend in sync |
| 6 | No schematic version drift | Angular schematics change between major versions; the bash approach is immune to that |

## Bash Scaffolder — Cons

| # | Con | Detail |
|---|-----|--------|
| 1 | No IDE integration | `ng generate` plugs into VS Code, WebStorm, and Angular Language Service; the bash script does not |
| 2 | No dry-run | `ng generate --dry-run` shows what would be created without writing files; the bash script just writes |
| 3 | Fragile string templating | Heredocs with shell variable expansion are error-prone (escaping backticks, dollar signs in template literals) |
| 4 | No validation | `ng generate` validates against the Angular project structure (module imports, route registration); the bash script can generate files that don't compile |
| 5 | Manual wiring still required | `ng generate` can auto-register components in routes/modules; the bash script leaves manual steps (OpenAPI, DI wiring, route registration) |
| 6 | No update/migration path | Angular schematics support `ng update` for evolving existing features; regenerating with bash would overwrite customizations |
| 7 | Naive pluralization | `${SNAKE}s` breaks on names already plural or irregular plurals (`category` → `categorys`) |

---

## Mitigations for Cons

| Con | Mitigation |
|-----|------------|
| No dry-run | Add a `--dry-run` flag that prints paths instead of writing |
| Fragile templating | Catch issues with `make lint-arch` + `make test` after scaffolding |
| No auto-wiring | The "next steps" output already guides developers; could be automated in the script |
| Naive pluralization | Accept an explicit `--plural` flag for edge cases |

---

## Decision

The bash scaffolder is kept because its **cross-stack single-pass generation** is the primary value — `ng generate` cannot scaffold the Python backend.

For Angular-only artifacts that have no backend counterpart (pipes, directives, guards), using `ng generate` alongside the bash scaffolder remains a valid option. The two approaches are not mutually exclusive.

---

## Consequences

- The scaffolder script must stay under 250 lines per the project's design principles.
- New features that add only Angular artifacts (no backend) may use `ng generate` directly.
- The `--dry-run` and `--plural` flags should be added as follow-up improvements.
