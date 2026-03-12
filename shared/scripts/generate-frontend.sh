#!/bin/bash
set -euo pipefail

echo "Generating TypeScript client from OpenAPI spec..."
cd "$(dirname "$0")/../.."
PROJECT_ROOT="$(pwd)"

if [ ! -f shared/openapi.json ]; then
  echo "Error: shared/openapi.json not found. Run 'make generate' from the project root."
  exit 1
fi

npx --workspace=frontend openapi-ts

echo "✓ Frontend API client generated at frontend/src/app/shared/api/generated/"
