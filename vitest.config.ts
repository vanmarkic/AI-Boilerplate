import { defineConfig } from 'vitest/config';

/**
 * Root vitest config — prevents bare `npx vitest run` from failing.
 *
 * Angular component tests require the Angular compiler pipeline.
 * Run them via:
 *
 *   cd frontend && npx ng test          # interactive
 *   cd frontend && npx ng test --watch=false   # CI
 *
 * This config only includes non-Angular specs (e.g. design-system
 * token smoke tests) so a bare `npx vitest run` at the repo root
 * exits cleanly instead of failing on Angular-specific import errors.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['packages/design-system/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
