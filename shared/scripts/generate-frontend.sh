#!/bin/bash
set -euo pipefail

echo "Generating TypeScript client from OpenAPI spec..."
cd "$(dirname "$0")/../.."

if [ ! -f shared/openapi.json ]; then
  echo "Error: shared/openapi.json not found. Run 'make generate' from the project root."
  exit 1
fi

frontend/node_modules/.bin/openapi-ts \
  -i shared/openapi.json \
  -o frontend/src/app/shared/api/generated \
  -c @hey-api/client-fetch

echo "✓ Frontend API client generated at frontend/src/app/shared/api/generated/"
