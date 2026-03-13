import { defineConfig } from 'vitest/config';

/**
 * Root vitest config — prevents bare `npx vitest run` from failing.
 *
 * All specs in this repo are Angular component tests that require the
 * Angular compiler pipeline.  Run them via:
 *
 *   cd frontend && npx ng test          # interactive
 *   cd frontend && npx ng test --watch=false   # CI
 *
 * This config intentionally includes no test files so that a bare
 * `npx vitest run` at the repo root exits cleanly instead of failing
 * on 40+ Angular-specific import errors.
 */
export default defineConfig({
  test: {
    include: [],
    passWithNoTests: true,
  },
});
