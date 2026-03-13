export interface EnvironmentConfig {
  production: boolean;
  apiBaseUrl: string;
  keycloak: { url: string; realm: string; clientId: string };
}
