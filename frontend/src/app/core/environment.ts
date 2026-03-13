/**
 * Runtime environment configuration.
 *
 * Values are injected at container startup via env-config.js (see frontend/public/env-config.js).
 * During local dev (`ng serve`), the defaults below are used as-is.
 * In Docker/K8s, the entrypoint replaces __PLACEHOLDER__ tokens in env-config.js
 * so the same build artifact works across staging, production, and per-customer deploys.
 */

interface EnvironmentConfig {
  production: boolean;
  apiBaseUrl: string;
  keycloak: { url: string; realm: string; clientId: string };
}

const windowEnv = (window as unknown as { __ENV__?: Partial<EnvironmentConfig> }).__ENV__;

const defaults: EnvironmentConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'boilerplate',
    clientId: 'frontend-app',
  },
};

export const environment: EnvironmentConfig = {
  ...defaults,
  ...windowEnv,
  keycloak: { ...defaults.keycloak, ...windowEnv?.keycloak },
};
