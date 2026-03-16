/**
 * Development environment — used by `ng serve` and `ng build --configuration=development`.
 *
 * For production builds, angular.json fileReplacements swaps this file
 * with environment.prod.ts. Add new environments the same way
 * (environment.staging.ts, etc.) — see angular.json "configurations".
 */

import type { EnvironmentConfig } from './environment.config';

export const environment: EnvironmentConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'boilerplate',
    clientId: 'frontend-app',
  },
};
