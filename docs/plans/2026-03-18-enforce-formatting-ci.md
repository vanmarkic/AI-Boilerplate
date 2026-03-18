# Enforce Code Formatting in CI (Issue #145)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ruff format + ruff check enforcement for TFC backend in CI, update pre-push hooks, and expand ruff rules for both backends.

**Architecture:** CI-only change — no runtime code changes. Adds TFC backend lint steps to the existing `lint-backend` CI job, updates the pre-push hook to cover both backends, and expands ruff rules to catch security/async/pytest anti-patterns.

**Tech Stack:** ruff (Python linter/formatter), GitHub Actions, shell scripts

---

## Pre-Implementation Discovery

### Current violations (must fix before CI will pass)

**TFC backend (`apps/tfc/backend/`):**
- `ruff format`: 97 files need reformatting
- `ruff check` (existing rules): 139 violations (94 auto-fixable)
- `ruff check` (new rules): 43 violations (21 auto-fixable)
- `target-version` is `py311` but code uses PEP 695 syntax (Python 3.12+) — must bump

**Main backend (`apps/main/backend/`):**
- `ruff format`: 20 files need reformatting
- `ruff check` (new rules): 15 violations (11 auto-fixable)

### New ruff rules to add

| Rule | Category | Rationale |
|------|----------|-----------|
| `ASYNC` | Async patterns | TFC is heavily async (FastAPI + WebSocket) |
| `S` | Security (Bandit) | AGENTS.md mandates auth everywhere |
| `PT` | Pytest style | Enforces pytest best practices |
| `T20` | Print statements | Engine must stay pure, no print in prod |
| `RUF` | Ruff-specific | Modern Python idioms, unused noqa cleanup |

### Ignores needed

| Rule | Reason |
|------|--------|
| `S101` | `assert` is needed in test files |
| `S311` | `random.choices` in migration for session codes — not crypto |
| `S603` | `subprocess` in mutation_test.py — developer tool |
| `T20` per-file | `mutation_test.py` and `validate_seeds.py` are CLI scripts |

---

## Tasks

### Task 1: Fix TFC backend — bump target-version + auto-fix format/lint

**Files:**
- Modify: `apps/tfc/backend/pyproject.toml` (line 37: `target-version`)
- Auto-fix: all `.py` files under `apps/tfc/backend/`

**Step 1: Bump target-version from py311 to py312**

In `apps/tfc/backend/pyproject.toml`, change:
```toml
target-version = "py311"
```
to:
```toml
target-version = "py312"
```

**Step 2: Auto-fix ruff format**

```bash
cd apps/tfc/backend && ruff format .
```

**Step 3: Auto-fix ruff check (safe fixes only)**

```bash
cd apps/tfc/backend && ruff check --fix .
```

**Step 4: Review remaining violations and fix manually**

```bash
cd apps/tfc/backend && ruff check . --statistics
```

Fix any remaining violations (E501 line-too-long, F841 unused variables, ANN202 missing return types, N815 mixed case).

**Step 5: Verify clean**

```bash
cd apps/tfc/backend && ruff check . && ruff format --check .
```
Expected: no errors

**Step 6: Commit**

```bash
git add apps/tfc/backend/
git commit -m "style(tfc): auto-fix ruff format + lint violations

Bump target-version to py312 (code already uses PEP 695 syntax).
Run ruff format and ruff check --fix for consistency."
```

### Task 2: Fix main backend — auto-fix format/lint

**Files:**
- Auto-fix: all `.py` files under `apps/main/backend/`

**Step 1: Auto-fix ruff format**

```bash
cd apps/main/backend && ruff format .
```

**Step 2: Auto-fix ruff check (safe fixes only)**

```bash
cd apps/main/backend && ruff check --fix .
```

**Step 3: Verify clean**

```bash
cd apps/main/backend && ruff check . && ruff format --check .
```
Expected: no errors

**Step 4: Commit**

```bash
git add apps/main/backend/
git commit -m "style(main): auto-fix ruff format + lint violations"
```

### Task 3: Expand ruff rules in both pyproject.toml files

**Files:**
- Modify: `apps/tfc/backend/pyproject.toml` (lines 40-42)
- Modify: `apps/main/backend/pyproject.toml` (lines 52-54)

**Step 1: Update TFC pyproject.toml**

Replace:
```toml
[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "ANN"]
ignore = []
```

With:
```toml
[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "ANN", "ASYNC", "S", "PT", "T20", "RUF"]
ignore = [
    "S101",   # assert used in tests
]

[tool.ruff.lint.per-file-ignores]
"mutation_test.py" = ["T20", "S603"]
"validate_seeds.py" = ["T20"]
"alembic/**" = ["ANN"]
```

**Step 2: Update main pyproject.toml**

Same `select` and `ignore` additions. Adapt per-file-ignores to main backend's files.

**Step 3: Verify both pass**

```bash
cd apps/tfc/backend && ruff check . && cd ../../main/backend && ruff check .
```

**Step 4: Commit**

```bash
git add apps/tfc/backend/pyproject.toml apps/main/backend/pyproject.toml
git commit -m "chore: expand ruff rules — add ASYNC, S, PT, T20, RUF

Adds security (bandit), async, pytest-style, print-detection,
and ruff-specific rules to both backends. Keeps them aligned."
```

### Task 4: Fix new-rule violations in both backends

**Step 1: Auto-fix safe violations**

```bash
cd apps/tfc/backend && ruff check --fix .
cd ../../main/backend && ruff check --fix .
```

**Step 2: Fix remaining violations manually**

Review `ruff check . --statistics` output and fix:
- `RUF100` unused noqa → remove stale noqa comments
- `PT022` yield fixtures → change `yield` to `return`
- `PT019` unused fixtures → use `@pytest.mark.usefixtures`
- `RUF012` mutable class default → add `ClassVar` annotation
- `S311` random usage → add `# noqa: S311` with comment explaining why
- `RUF059` unused unpacked → replace with `_`

**Step 3: Verify both clean**

```bash
cd apps/tfc/backend && ruff check . && cd ../../main/backend && ruff check .
```

**Step 4: Commit**

```bash
git add apps/tfc/backend/ apps/main/backend/
git commit -m "fix: resolve new ruff rule violations (ASYNC, S, PT, T20, RUF)"
```

### Task 5: Add TFC backend lint steps to CI

**Files:**
- Modify: `.github/workflows/ci.yml` (lines 108-119, `lint-backend` job)

**Step 1: Add TFC lint steps**

Update the `lint-backend` job to add TFC steps after main:

```yaml
  lint-backend:
    name: Backend Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install ruff
      # Main backend
      - run: ruff check .
        working-directory: apps/main/backend
      - run: ruff format --check .
        working-directory: apps/main/backend
      # TFC backend
      - run: ruff check .
        working-directory: apps/tfc/backend
      - run: ruff format --check .
        working-directory: apps/tfc/backend
```

Note: `pip install ruff` is separated from `ruff check` so both backends share the install.

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add TFC backend ruff check + format to lint job (#145)"
```

### Task 6: Update pre-push hook

**Files:**
- Modify: `shared/scripts/pre-push.sh` (lines 46-56)

**Step 1: Update hook to cover both backends with both checks**

Replace the lint section (Step 4) with:

```bash
# Step 4: Lint (must pass to push)
echo ""
echo "═══ pre-push: running linters ═══"

for backend in apps/main/backend apps/tfc/backend; do
  name=$(basename $(dirname "$backend"))/$(basename "$backend")
  echo "→ $name: ruff check"
  if ! (cd "$ROOT/$backend" && ruff check .); then
    echo "✗ $name ruff check failed"
    exit 1
  fi
  echo "→ $name: ruff format --check"
  if ! (cd "$ROOT/$backend" && ruff format --check .); then
    echo "✗ $name ruff format failed"
    exit 1
  fi
done

echo "→ frontend: eslint"
if ! (cd "$ROOT/apps/main/frontend" && npx eslint "**/*.{js,ts,html,json}"); then
  echo "✗ Frontend lint failed"
  exit 1
fi

echo "✓ All linters passed"
```

**Step 2: Commit**

```bash
git add shared/scripts/pre-push.sh
git commit -m "chore: update pre-push hook — both backends, ruff format check (#145)"
```

### Task 7: Update Makefile lint target

**Files:**
- Modify: `Makefile` (line 134-136, `lint` target)

**Step 1: Add TFC + format checks to lint target**

Replace:
```makefile
lint: ## Run all linters
	cd $(MAIN_BE) && ruff check .
	cd $(MAIN_FE) && npx eslint "**/*.{js,ts,html,json}"
```

With:
```makefile
lint: ## Run all linters
	cd $(MAIN_BE) && ruff check . && ruff format --check .
	cd $(TFC_BE) && ruff check . && ruff format --check .
	cd $(MAIN_FE) && npx eslint "**/*.{js,ts,html,json}"
```

**Step 2: Commit**

```bash
git add Makefile
git commit -m "chore: add TFC lint + format check to Makefile lint target"
```

### Task 8: Final verification

**Step 1: Run full local check**

```bash
make check
```

**Step 2: Verify CI config is valid**

```bash
# Ensure no YAML syntax errors
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
```
