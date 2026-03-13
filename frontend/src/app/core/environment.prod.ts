/**
 * Production environment — swapped in by angular.json fileReplacements
 * when building with `ng build --configuration=production`.
 *
 * To add a new target (staging, customer-X), copy this file to
 * environment.<target>.ts, add a configuration + fileReplacement
 * in angular.json, and build with `ng build --configuration=<target>`.
 */

import type { EnvironmentConfig } from './environment';

export const environment: EnvironmentConfig = {
  production: true,
  apiBaseUrl: 'https://api.example.com',
  keycloak: {
    url: 'https://auth.example.com',
    realm: 'boilerplate',
    clientId: 'frontend-app',
  },
};
