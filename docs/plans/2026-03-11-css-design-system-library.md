# CSS Design System Library Extraction

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the 4 CSS files into a standalone, framework-agnostic npm package (`@aspect/design-system`) at the monorepo root, decouple the one Angular-specific selector, wire the Angular consumer to import from the package, and add framework recipe docs.

**Architecture:** The library is a zero-dependency CSS package — no JavaScript, no preprocessors, no build step. It ships 4 CSS files and a manifest `index.css`. Consumers import via `@import "@aspect/design-system"` or bundler entry. The Angular frontend becomes a consumer, importing the package instead of owning the CSS files. Framework recipes (Angular, React, Vue) ship as markdown docs in the package — copy-paste snippets, not runnable code.

**Tech Stack:** Pure CSS (`@layer`, native nesting, `oklch()`, `color-mix()`), npm workspaces for local linking.

---

## Task 1: Scaffold the package directory

**Files:**
- Create: `packages/design-system/package.json`
- Create: `packages/design-system/index.css`
- Create: `packages/design-system/CHANGELOG.md`

**Step 1: Create package directory**

```bash
mkdir -p packages/design-system
```

**Step 2: Create package.json**

```json
{
  "name": "@aspect/design-system",
  "version": "0.1.0",
  "description": "Framework-agnostic CSS design system — tokens, reset, utilities, components",
  "license": "MIT",
  "type": "module",
  "style": "index.css",
  "exports": {
    ".": "./index.css",
    "./tokens.css": "./tokens.css",
    "./reset.css": "./reset.css",
    "./utilities.css": "./utilities.css",
    "./components.css": "./components.css"
  },
  "files": [
    "*.css",
    "docs/"
  ],
  "keywords": ["css", "design-system", "tokens", "oklch", "css-layers"]
}
```

Key fields:
- `style` — bundlers (webpack, Vite, Parcel) resolve CSS entry via this field
- `exports` — allows granular imports (`@aspect/design-system/tokens.css`)
- `files` — only CSS and docs ship to npm (no test files, no config)

**Step 3: Create index.css manifest**

```css
/* @aspect/design-system — framework-agnostic CSS design system
 * Import this file for the complete system, or import individual files:
 *   @import "@aspect/design-system/tokens.css";
 *   @import "@aspect/design-system/reset.css";
 *   @import "@aspect/design-system/utilities.css";
 *   @import "@aspect/design-system/components.css";
 */

@layer reset, tokens, utilities, components;

@import "./tokens.css";
@import "./reset.css";
@import "./utilities.css";
@import "./components.css";
```

**Step 4: Create empty CHANGELOG**

```markdown
# Changelog

## 0.1.0

- Initial extraction from AI-Boilerplate frontend
- Tokens: OKLCH colors, 4px spacing grid, typography scale, shadows, motion, z-index
- Reset: minimal box-sizing + body defaults
- Utilities: ~80 single-responsibility classes (layout, spacing, typography, color, border, shadow)
- Components: button, badge, card, input, form-error, dialog (variant logic via data-* attributes)
```

**Step 5: Commit**

```bash
git add packages/design-system/
git commit -m "feat(design-system): scaffold package directory and manifest"
```

---

## Task 2: Move CSS files and decouple `[appButton]`

**Files:**
- Move: `frontend/src/styles/tokens.css` → `packages/design-system/tokens.css`
- Move: `frontend/src/styles/reset.css` → `packages/design-system/reset.css`
- Move: `frontend/src/styles/utilities.css` → `packages/design-system/utilities.css`
- Move: `frontend/src/styles/components.css` → `packages/design-system/components.css`
- Modify: `packages/design-system/components.css` (rename `[appButton]` → `.btn`)

**Step 1: Copy the 4 CSS files to the package**

```bash
cp frontend/src/styles/tokens.css packages/design-system/tokens.css
cp frontend/src/styles/reset.css packages/design-system/reset.css
cp frontend/src/styles/utilities.css packages/design-system/utilities.css
cp frontend/src/styles/components.css packages/design-system/components.css
```

**Step 2: Rename `[appButton]` to `.btn` in the package copy**

In `packages/design-system/components.css`, replace every occurrence of `[appButton]` with `.btn`.

This is the **only** Angular-coupled selector. All other selectors (`.badge`, `.card`, `.dialog-panel`, etc.) are already framework-agnostic CSS classes.

The change is purely in the package — the frontend's own `components.css` keeps `[appButton]` until Task 4 decides what to do.

**Step 3: Verify the package CSS is valid**

```bash
cd packages/design-system && cat index.css
```

Confirm the imports resolve: `index.css` → `tokens.css`, `reset.css`, `utilities.css`, `components.css` all exist.

**Step 4: Commit**

```bash
git add packages/design-system/
git commit -m "feat(design-system): add CSS files with framework-agnostic selectors"
```

---

## Task 3: Wire npm workspaces for local linking

**Files:**
- Create or modify: `package.json` (root — create if it doesn't exist)
- Modify: `frontend/package.json` (add workspace dependency)

**Step 1: Create root package.json with workspaces**

Check if a root `package.json` exists. If not, create one:

```json
{
  "private": true,
  "workspaces": [
    "packages/*",
    "frontend"
  ]
}
```

If one already exists, just add the `workspaces` field.

**Step 2: Add the dependency to frontend**

In `frontend/package.json`, add to `dependencies`:

```json
"@aspect/design-system": "workspace:*"
```

**Step 3: Install to create the symlink**

```bash
cd /Users/dragan/Documents/AI-Boilerplate && npm install
```

This creates a symlink from `frontend/node_modules/@aspect/design-system` → `packages/design-system`.

**Step 4: Verify the symlink**

```bash
ls -la frontend/node_modules/@aspect/design-system/
```

Should point to `../../packages/design-system`.

**Step 5: Commit**

```bash
git add package.json frontend/package.json frontend/package-lock.json
git commit -m "chore: wire npm workspaces for design-system local linking"
```

---

## Task 4: Update the Angular frontend to consume the package

**Files:**
- Modify: `frontend/src/styles/styles.css` (import from package instead of local files)
- Delete: `frontend/src/styles/tokens.css`
- Delete: `frontend/src/styles/reset.css`
- Delete: `frontend/src/styles/utilities.css`
- Delete: `frontend/src/styles/components.css`
- Create: `frontend/src/styles/overrides.css` (optional — local-only overrides)

**Step 1: Replace styles.css with package import + local button override**

The package uses `.btn` but our Angular app uses `[appButton]` (the directive). We need a thin override layer that maps `[appButton]` to the same styles, OR we update the directive to add a `btn` class. The cleaner approach: **add `class: 'btn'` to the directive host** so the package CSS applies, no override needed.

Replace `frontend/src/styles/styles.css` with:

```css
/* ── Design System ───────────────────────────────────────
 * Imports the full design system from @aspect/design-system.
 * Local overrides (if any) go in overrides.css.
 * ──────────────────────────────────────────────────────── */

@import "@aspect/design-system";
```

**Step 2: Update ButtonDirective to add `.btn` class**

In `frontend/src/app/shared/ui/button.directive.ts`, add `class: 'btn'` to the host so the package's `.btn` selector matches:

```typescript
import { Directive, input } from '@angular/core';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'default' | 'lg';

@Directive({
  selector: 'button[appButton], a[appButton]',
  host: {
    'class': 'btn',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
  },
})
export class ButtonDirective {
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('default');
}
```

**Step 3: Delete the local CSS files**

```bash
rm frontend/src/styles/tokens.css
rm frontend/src/styles/reset.css
rm frontend/src/styles/utilities.css
rm frontend/src/styles/components.css
```

**Step 4: Run build + tests**

```bash
cd frontend && npm run build && npm run test:ci
```

Expected: Build succeeds, all 39 tests pass. The Angular build resolves `@import "@aspect/design-system"` via the workspace symlink in `node_modules`.

**Step 5: Run lint**

```bash
npm run lint:all
```

Expected: Clean (stylelint, eslint, tsc, cspell all pass).

Note: If stylelint fails on the package CSS, update `frontend/.stylelintrc.json` to ignore `node_modules/@aspect/` or scope linting to `src/` only. The package should have its own lint config (Task 6).

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(frontend): consume @aspect/design-system package, delete local CSS"
```

---

## Task 5: Update button tests for `.btn` class

**Files:**
- Modify: `frontend/src/app/shared/ui/button.directive.spec.ts`

**Step 1: Add test for `.btn` class on host**

Add one assertion to the existing "should apply default variant" test (or add a new test):

```typescript
it('should have btn class on host', () => {
  expect(button.classList.contains('btn')).toBe(true);
});
```

**Step 2: Run tests**

```bash
cd frontend && npm run test:ci
```

Expected: All tests pass (39 + 1 = 40).

**Step 3: Commit**

```bash
git add frontend/src/app/shared/ui/button.directive.spec.ts
git commit -m "test(button): assert .btn class on directive host"
```

---

## Task 6: Add lint config and scripts to the package

**Files:**
- Create: `packages/design-system/.stylelintrc.json`
- Modify: `packages/design-system/package.json` (add lint script)

**Step 1: Create stylelint config**

```json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "custom-property-pattern": null,
    "no-descending-specificity": null,
    "import-notation": "string",
    "at-rule-no-unknown": [true, {
      "ignoreAtRules": ["layer"]
    }]
  }
}
```

**Step 2: Add devDependencies and lint script to package.json**

Add to `packages/design-system/package.json`:

```json
{
  "devDependencies": {
    "stylelint": "^16.0.0",
    "stylelint-config-standard": "^37.0.0"
  },
  "scripts": {
    "lint": "stylelint \"*.css\""
  }
}
```

**Step 3: Run lint in the package**

```bash
cd packages/design-system && npx stylelint "*.css"
```

Expected: Clean (0 errors).

**Step 4: Commit**

```bash
git add packages/design-system/
git commit -m "chore(design-system): add stylelint config and lint script"
```

---

## Task 7: Write framework recipe docs

**Files:**
- Create: `packages/design-system/docs/README.md`
- Create: `packages/design-system/docs/recipes/angular.md`
- Create: `packages/design-system/docs/recipes/react.md`
- Create: `packages/design-system/docs/recipes/vue.md`

**Step 1: Create the main README**

Document:
- What the package is (framework-agnostic CSS design system)
- How to install (`npm install @aspect/design-system`)
- How to import (full bundle vs individual files)
- The `@layer` cascade order and why it matters
- The `data-*` attribute contract for component variants
- Font setup (install `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono`)
- Link to framework recipes

**Step 2: Angular recipe**

Show the complete ~10-line wrapper for each component:
- `ButtonDirective` — directive with `class: 'btn'`, `[attr.data-variant]`, `[attr.data-size]`
- `BadgeComponent` — component with `class: 'badge'`, `[attr.data-variant]`
- `CardComponent` — component with `class: 'card'`, template using `.card-title`, `.card-content`
- `InputComponent` — component with `class: 'input-wrapper'`, template using `.input-label`, `.input-base`
- `FormErrorComponent` — component using `.form-error`
- `DialogPanelComponent` — component using `.dialog-*` classes + `[attr.data-variant]`

Show angular.json `styles` array setup for fonts + package import.

**Step 3: React recipe**

Show the equivalent React components. Each is a thin wrapper:
- `Button` — `<button className="btn" data-variant={variant} data-size={size}>`
- `Badge` — `<span className="badge" data-variant={variant}>`
- `Card` — `<div className="card">` with `.card-title`, `.card-content`
- `Input` — `<div className="input-wrapper">` with `.input-label`, `.input-base`
- `FormError` — `<p className="form-error">`
- `Dialog` — `<div className="dialog-backdrop">` + `<div className="dialog-panel" data-variant={variant}>`

Show Vite setup: `import "@aspect/design-system"` in `main.tsx`.

**Step 4: Vue recipe**

Show the equivalent Vue SFCs. Same pattern as React but with Vue syntax:
- `<template>` with class bindings + `:data-variant`
- `<script setup>` with `defineProps`
- No `<style>` block — all styles come from the package

Show Vite setup: `import "@aspect/design-system"` in `main.ts`.

**Step 5: Commit**

```bash
git add packages/design-system/docs/
git commit -m "docs(design-system): add README and framework recipes (Angular, React, Vue)"
```

---

## Task 8: Update project documentation

**Files:**
- Modify: `CLAUDE.md` (document the package)
- Modify: `frontend/.cspell.json` (add "aspect" if needed)

**Step 1: Update CLAUDE.md project structure**

Update the project structure section to show:

```
frontend/          Angular 21 (zoneless, signals, standalone)
backend/           FastAPI + Postgres
packages/
  design-system/   Framework-agnostic CSS design system
```

Update the CSS Architecture section to note that CSS lives in `packages/design-system/` and is consumed via `@import "@aspect/design-system"`.

**Step 2: Update cspell if needed**

Add any new words to `.cspell.json` (e.g., "aspect" if it triggers spell check).

**Step 3: Final verification**

```bash
cd frontend && npm run build && npm run test:ci && npm run lint:all
```

Expected: All green.

**Step 4: Commit**

```bash
git add CLAUDE.md frontend/.cspell.json
git commit -m "docs: update project docs for design-system package extraction"
```

---

## Summary

| Task | What | Estimated Time |
|------|------|----------------|
| 1 | Scaffold package directory | 10 min |
| 2 | Move CSS files + decouple `[appButton]` → `.btn` | 10 min |
| 3 | Wire npm workspaces | 10 min |
| 4 | Update Angular frontend to consume package | 15 min |
| 5 | Update button tests for `.btn` class | 5 min |
| 6 | Add lint config to package | 10 min |
| 7 | Write framework recipe docs | 30 min |
| 8 | Update project documentation | 10 min |
| **Total** | | **~2 hours** |

## Key Design Decisions

1. **`.btn` over `[data-button]`** — Class selectors are the universal CSS primitive. Every framework has a natural way to set classes. `data-button` works too but is unconventional for a root selector.

2. **npm workspaces over publishing** — Local symlinking via workspaces means zero publish ceremony during development. When ready to share externally, just `npm publish`.

3. **No JavaScript in the package** — The package is pure CSS. No TypeScript, no component definitions, no framework dependency. This is what makes it consumable by *any* frontend.

4. **Recipes as docs, not code** — Framework wrappers are copy-paste snippets in markdown. They're not published code. This means zero maintenance — if Angular 22 changes something, only the recipe doc needs updating.

5. **Angular consumer adds `class: 'btn'` to directive host** — Rather than maintaining a separate `[appButton]` override in an overrides.css, we make the directive emit the framework-agnostic class. The directive is the integration layer; the CSS is the contract.
