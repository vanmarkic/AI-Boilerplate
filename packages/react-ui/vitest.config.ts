import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// @ts-expect-error -- resolved by Vite at runtime, not by project tsconfig
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
// @ts-expect-error -- same as above
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react(), storybookTest({ configDir: '.storybook' })],
  optimizeDeps: {
    include: ['storybook/test'],
  },
  test: {
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.tsx',
        'src/**/*.spec.{ts,tsx}',
        'src/test-setup.ts',
        'src/index.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
