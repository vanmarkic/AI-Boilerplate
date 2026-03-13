#!/bin/sh
# Replace __PLACEHOLDER__ tokens in env-config.js with real env vars at container startup.
# This lets a single Docker image work across all environments without rebuilding.

ENV_CONFIG="/app/dist/frontend/browser/env-config.js"

if [ -f "$ENV_CONFIG" ]; then
  sed -i "s|__PRODUCTION__|${PRODUCTION:-false}|g" "$ENV_CONFIG"
  sed -i "s|__API_BASE_URL__|${API_BASE_URL:-http://localhost:8000}|g" "$ENV_CONFIG"
  sed -i "s|__KEYCLOAK_URL__|${KEYCLOAK_URL:-http://localhost:8080}|g" "$ENV_CONFIG"
  sed -i "s|__KEYCLOAK_REALM__|${KEYCLOAK_REALM:-boilerplate}|g" "$ENV_CONFIG"
  sed -i "s|__KEYCLOAK_CLIENT_ID__|${KEYCLOAK_CLIENT_ID:-frontend-app}|g" "$ENV_CONFIG"
fi

exec "$@"
