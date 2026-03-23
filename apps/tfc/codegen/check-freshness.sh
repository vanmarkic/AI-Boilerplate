#!/usr/bin/env bash
# Verify generated TypeScript files match current Python sources.
# Exit 1 if stale (for CI).
set -euo pipefail

cd "$(dirname "$0")/.."
python3 codegen/generate-types.py
# Format generated files so they match the prettier-formatted committed versions
npx --prefix frontend prettier --write frontend/src/app/core/generated/ --log-level silent 2>/dev/null || true
if ! git diff --quiet frontend/src/app/core/generated/; then
  echo "ERROR: Generated types are stale. Run: npm run generate:types"
  git diff frontend/src/app/core/generated/
  exit 1
fi
echo "Generated types are up to date."
