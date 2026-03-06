# Feature Development Workflow

Scripts drive the structure. LLMs fill in the domain-specific content.

## The Sequence

```
  SPECIFY ──→ SCAFFOLD ──→ FILL IN ──→ VALIDATE ──→ SHIP
  (human)     (scripts)    (LLM)       (scripts)    (git)
```

### Step 1: SPECIFY (human writes, LLM assists)

Define the feature before writing any code.

```bash
# Generate a SPECS.md section template
make spec name=orders tier=2

# Copy the output into SPECS.md under "Features & Business Rules"
# Fill in: purpose, business rules, user stories, API endpoints
```

**LLM can help here:** "Help me draft the SPECS.md section for an orders feature."

### Step 2: SCAFFOLD (human runs scripts)

```bash
# Creates 12 skeleton files (backend + frontend)
make new-feature name=orders tier=2
```

This generates:
- Backend: model, schema, repository, service, router, test, manifest, `__init__.py`
- Frontend: types, service, component, routes, spec

These are skeleton files with `TODO` markers. No LLM needed — this is deterministic.

### Step 3: FILL IN (LLM does the creative work)

Open your LLM tool and point it at the skeleton files:

**With Aider:**
```bash
make aider-fill-in
# Then add the feature files and say:
# "Fill in the orders feature. SPECS.md has the domain model."
```

**With Claude Code:**
```
Fill in the orders feature. SPECS.md has the domain model. Skeleton files are ready.
```

The LLM fills in:
- Model fields (from SPECS.md domain model)
- Schema validation rules (from business rules)
- Repository queries
- Service logic
- Router wiring (Pydantic models + FastAPI decorators define the API contract)
- Test cases (TDD: test first, then implementation)
- Frontend component + service logic
- Alembic migration (`cd backend && alembic revision --autogenerate -m 'add orders'`)

After filling in the backend routers, run `make generate` to extract the OpenAPI spec and regenerate the TypeScript client.

### Step 4: VALIDATE (human runs scripts)

```bash
# One command checks everything: architecture + linters + tests
make validate
```

If failures → go back to Step 3 and tell the LLM what failed.

### Step 5: SHIP (human runs git)

```bash
git add -p
git commit -m "feat(orders): add order placement and tracking"
gh pr create
```

CI runs automatically (`.github/workflows/ci.yml`).

## When to Use Which Tool

| Task | Tool | Why |
|------|------|-----|
| Draft spec | **Any LLM** (conversation) | Creative, needs domain reasoning |
| Scaffold files | **`make new-feature`** | Deterministic, instant |
| Fill in skeleton code | **Aider** (`make aider-fill-in`) | File-scoped TDD, diff-focused |
| Fill in multi-file feature | **Claude Code** | Cross-file reasoning, large context |
| Debug a failure | **Aider** (`make aider-debug`) or **Claude Code** | Root cause analysis |
| Review code | **Claude Code** | Multi-file reasoning |
| Validate | **`make validate`** | Deterministic, comprehensive |
| Autocomplete / inline edits | **Continue.dev** | IDE-integrated, fast |

## Anti-Patterns

- **Don't** start coding before SPECS.md has the feature section
- **Don't** ask the LLM to scaffold — use `make new-feature`
- **Don't** ask the LLM to run tests — use `make validate`
- **Don't** use multiple LLM tools for the same phase — pick one
- **Don't** use brainstorm/plan/verify prompts — the scripts handle the lifecycle
