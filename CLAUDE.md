# AI-Boilerplate

## Project Structure

```
frontend/          Angular 21 (zoneless, signals, standalone)
backend/           FastAPI + Postgres
packages/
  design-system/   Framework-agnostic CSS design system
```

## Frontend Conventions

### Design System

**Pattern: Headless directives on native elements.**

- **Interactive controls** → directive on `<button>`, `<a>`, `<input>` etc.
  ```html
  <button appButton variant="destructive" size="lg">Delete</button>
  ```
- **Display components** → component with semantic CSS class + `data-*` host binding (badge, card)
- **Complex ARIA** → `@angular/aria` directives (tabs, menu, combobox)
- **Overlays** → native `<dialog>`, Popover API

Reference implementation: `button.directive.ts` + `button.component.ts`

### Variant Strategy

Components use `data-*` HTML attributes for variant/size logic, styled via CSS attribute selectors:
```typescript
host: { '[attr.data-variant]': 'variant()', '[attr.data-size]': 'size()' }
```
```css
[appButton][data-variant="destructive"] { background-color: var(--color-destructive); }
```
No runtime class computation. No `cn()`, `clsx`, or `tailwind-merge`.

### Design Tokens

All visual decisions in `packages/design-system/tokens.css` as CSS custom properties on `:root`.
OKLCH color space. 4px spacing grid. Never hardcode colors/spacing in components.

### CSS Architecture

**`packages/design-system/` is the single source of truth for all CSS.**
Do NOT write new CSS in Angular components or `frontend/src/styles/`. If a utility class or component style is missing, add it to the design-system package.

Pure web-native CSS. No Tailwind, no PostCSS, no preprocessors.
Consumed via `@import "@aspect/design-system"` in `frontend/src/styles/styles.css`.
```
@layer reset, tokens, utilities, components;   ← cascade order in styles.css
```
- `tokens.css` — `:root` custom properties (colors, spacing, typography, shadows)
- `reset.css` — minimal box-sizing + body defaults
- `utilities.css` — single-responsibility utility classes (~100)
- `components.css` — semantic component styles with `data-*` attribute selectors

Uses: `@layer`, native nesting, `oklch()`, `color-mix()`, logical properties.

### Fonts

Variable fonts via `@fontsource-variable`. Loaded in `angular.json` styles array,
NOT via CSS `@import`.

### Testing

- Vitest + Angular TestBed
- Test hosts MUST use `signal()` for template-bound properties (zoneless CD)
- Use `fixture.componentRef.setInput()` for component inputs

### Storybook

- Storybook 10 + `@storybook/angular`
- Styles loaded via `browserTarget` from angular.json — no CSS imports in preview.ts
- `npm run storybook` (dev) / `npm run build-storybook` (build)

## Commands

```bash
cd frontend
npm run start          # Dev server
npm run build          # Production build
npm run test:ci        # Unit tests
npm run lint:all       # All linters (tsc + eslint + stylelint + cspell)
npm run storybook      # Storybook dev
npm run build-storybook # Storybook build
npm run e2e            # Playwright E2E
```
