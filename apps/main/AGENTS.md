# Main App

## First Steps
Before writing any code:
1. Read the root `AGENTS.md` — all universal rules apply here.
2. Read `apps/main/backend/AGENTS.md` for backend conventions and `apps/main/frontend/AGENTS.md` for frontend conventions.
3. Check if `apps/main/SPECS.md` is filled in. If empty or missing, ask the user for domain info and fill it in before writing code.

## Feature Tiering
1. Every feature MUST have a `tier` field in its `manifest.yaml` (1, 2, or 3).
2. Tier 1 = base features included in all builds.
3. Features must NOT import from a higher tier (tier-1 cannot import tier-2 code).
4. Use `make build-tier-N` to build Docker images for a specific tier.
5. Runtime feature flags (`core/feature_flags.py`, `feature-flag.service.ts`) toggle features WITHIN the shipped tier.
6. Scaffold new features with tier: `make new-feature name=analytics tier=2`.

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
- Do NOT import across tiers (tier-1 code must not import from tier-2 or tier-3).
- Do NOT edit generated API client files in `frontend/src/app/shared/api/generated/` — run `make generate` instead.
