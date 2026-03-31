import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npx vite --config e2e/fixtures/vite.config.ts --port 5199',
    url: 'http://localhost:5199',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
