/**
 * Runtime environment config.
 *
 * In production, the entrypoint.sh script injects window.__env with
 * apiBaseUrl and wsBaseUrl from Railway environment variables.
 * Falls back to local dev defaults.
 */
interface RuntimeEnv {
  apiBaseUrl?: string;
  wsBaseUrl?: string;
}

declare global {
  // Set by entrypoint.sh in production containers
  var __env: RuntimeEnv | undefined;
}

const runtimeEnv: RuntimeEnv | undefined = globalThis.__env;

export const environment = {
  production: !!runtimeEnv,
  apiBaseUrl: runtimeEnv?.apiBaseUrl ?? "http://localhost:8001",
  wsBaseUrl: runtimeEnv?.wsBaseUrl ?? "ws://localhost:8001",
};
