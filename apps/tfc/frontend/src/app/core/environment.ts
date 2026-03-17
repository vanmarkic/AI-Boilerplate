/**
 * Runtime environment config.
 *
 * In production, the entrypoint.sh script injects window.__env with
 * apiBaseUrl and wsBaseUrl from Railway environment variables.
 * Falls back to local dev defaults.
 */
const runtimeEnv = (globalThis as Record<string, unknown>).__env as
  | { apiBaseUrl?: string; wsBaseUrl?: string }
  | undefined;

export const environment = {
  production: !!runtimeEnv,
  apiBaseUrl: runtimeEnv?.apiBaseUrl ?? 'http://localhost:8001',
  wsBaseUrl: runtimeEnv?.wsBaseUrl ?? 'ws://localhost:8001',
};
