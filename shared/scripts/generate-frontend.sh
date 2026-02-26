#!/bin/bash
set -euo pipefail

echo "Generating TypeScript client from OpenAPI spec..."
cd "$(dirname "$0")/../.."

npx @hey-api/openapi-ts \
  -i shared/openapi.yaml \
  -o frontend/src/app/shared/api/generated \
  -c @hey-api/client-fetch

echo "✓ Frontend API client generated at frontend/src/app/shared/api/generated/"
