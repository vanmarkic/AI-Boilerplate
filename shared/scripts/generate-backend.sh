#!/bin/bash
set -euo pipefail

echo "Generating Pydantic models from OpenAPI spec..."
cd "$(dirname "$0")/../.."

datamodel-codegen \
  --input shared/openapi.yaml \
  --output backend/generated/models.py \
  --input-file-type openapi \
  --output-model-type pydantic_v2 \
  --use-standard-collections \
  --use-union-operator \
  --target-python-version 3.12

echo "✓ Backend models generated at backend/generated/models.py"
