/**
 * Runtime environment configuration — injected before Angular bootstraps.
 *
 * LOCAL DEV: This file is served as-is; the defaults in environment.ts apply.
 * DOCKER / K8s: The container entrypoint (docker-entrypoint.sh) replaces
 * __PLACEHOLDER__ tokens below with real env vars at container startup,
 * so a single build artifact works across all environments.
 *
 * To add a new variable:
 *   1. Add a __PLACEHOLDER__ here
 *   2. Add the sed replacement in docker-entrypoint.sh
 *   3. Add the field to EnvironmentConfig in environment.ts
 */
window.__ENV__ = {
  production: '__PRODUCTION__' === 'true',
  apiBaseUrl: '__API_BASE_URL__',
  keycloak: {
    url: '__KEYCLOAK_URL__',
    realm: '__KEYCLOAK_REALM__',
    clientId: '__KEYCLOAK_CLIENT_ID__',
  },
};
