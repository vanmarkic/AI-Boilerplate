#!/bin/bash
# Pre-push hook: regenerate API client (if possible), show diff, then lint.
# Push proceeds regardless of generation failure, but lint must pass.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
GENERATED_DIR="$ROOT/frontend/src/app/shared/api/generated"

echo "═══ pre-push: attempting API client generation ═══"

# Step 1: Try to extract OpenAPI spec from running backend
if cd "$ROOT/backend" && python -c "import json; from main import create_app; print(json.dumps(create_app().openapi(), indent=2))" > "$ROOT/shared/openapi.json" 2>/dev/null; then
  echo "✓ OpenAPI spec extracted"

  # Step 2: Regenerate frontend client
  if bash "$ROOT/shared/scripts/generate-frontend.sh"; then
    echo "✓ Frontend client regenerated"

    # Step 3: Show diff between regenerated and committed code
    cd "$ROOT"
    if ! git diff --quiet -- "$GENERATED_DIR"; then
      echo ""
      echo "⚠ Generated API client differs from committed version:"
      echo "────────────────────────────────────────────────────────"
      git diff --stat -- "$GENERATED_DIR"
      echo ""
      git diff -- "$GENERATED_DIR"
      echo "────────────────────────────────────────────────────────"
      echo "⚠ Consider committing the updated generated files."
      echo ""
    else
      echo "✓ Generated client matches committed version"
    fi
  else
    echo "⚠ Frontend client generation failed (openapi-ts error)"
  fi
else
  echo "⚠ Backend not available — skipping generation (using committed stubs)"
  git checkout -- "$ROOT/shared/openapi.json" 2>/dev/null  # restore committed version
fi

# Step 4: Lint (must pass to push)
echo ""
echo "═══ pre-push: running linters ═══"

for backend in apps/main/backend apps/tfc/backend; do
  name="$(basename "$(dirname "$backend")")/$(basename "$backend")"
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
