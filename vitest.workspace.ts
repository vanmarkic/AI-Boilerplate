import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace — overrides automatic npm-workspace project discovery.
 *
 * All specs in this repo are Angular component tests that require the
 * Angular compiler pipeline provided by @angular/build:unit-test.
 *
 * Run tests via:
 *   cd frontend && npx ng test              # interactive
 *   cd frontend && npx ng test --watch=false # CI
 *
 * This file prevents `npx vitest run` at the repo root from picking up
 * the frontend workspace and failing on Angular-specific imports.
 */
export default defineWorkspace([
  {
    test: {
      name: 'root',
      include: [],
      passWithNoTests: true,
    },
  },
]);
