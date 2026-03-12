# Feature Development Workflow

Scripts drive the structure. LLMs fill in the domain-specific content.

## Anti-Patterns (read first)

- **Don't** create feature files manually — use `make new-feature`
- **Don't** start coding before SPECS.md has the feature section
- **Don't** ask the LLM to scaffold — scripts handle the structure
- **Don't** write CSS in Angular component `styles` arrays — add styles to `packages/design-system/components.css`
- **Don't** use multiple LLM tools for the same phase — pick one

## The Sequence

```
  SPECIFY ──────→ SCAFFOLD ──→ FILL IN ──→ VALIDATE ──→ SHIP
  (human + LLM)   (scripts)    (LLM)       (scripts)    (git)
```

### Step 1: SPECIFY

```bash
make spec name=orders tier=2   # prints SPECS.md section template
# Copy output into SPECS.md and fill in business rules, API endpoints
```

LLM can ask questions and write the SPECS.md section on the user's behalf.

### Step 2: SCAFFOLD

```bash
make new-feature name=orders tier=2                  # generates 12+ skeleton files
make new-feature name=status tier=1 plural=statuses  # override naive plural
```

Generates: backend (model, schema, repository, service, router, test, manifest) + frontend (types, store, component, routes, spec). Auto-wires dependencies and router — no manual edits to `main.py` or `dependencies.py`. Idempotent — safe to re-run.

### Step 3: FILL IN

Fill in **every `TODO` marker** in the skeleton files:
- Model fields and schema (from SPECS.md)
- Service `create` method (get/list/delete are pre-filled)
- Test cases (failing test first, then implementation)
- Frontend store load method and component template
- Alembic migration: `cd backend && alembic revision --autogenerate -m 'add orders'`

Do not move to Step 4 until all `TODO` markers are resolved.

Then run `make generate` to extract the OpenAPI spec and regenerate the TypeScript client.

> **If `make generate` fails** (venv not active): commit backend code as-is, leave the frontend store API call as a `TODO`, and re-run once the Python environment is available. Do not hand-write the generated client.

### Step 4: VALIDATE

```bash
make validate   # architecture linter + all linters + all tests
```

If failures → tell the LLM what failed and go back to Step 3.

### Step 5: SHIP

```bash
git add -p && git commit -m "feat(orders): add order placement and tracking"
gh pr create
```
