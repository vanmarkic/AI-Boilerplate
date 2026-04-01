# React UI Theming — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Goal:** Allow consumers of the `@aspect/react-ui` GitLab package to pick their design system (theming) — either a pre-built theme or their own custom tokens.

## Context

The `@aspect/react-ui` package is distributed as a tarball CI artifact. Consumers currently import `@aspect/react-ui/design-system.css` which bundles everything: tokens (default Naval Group Corporate light), alternate themes (steel-blue, ocean), reset, utilities, and component styles.

This works for consumers who want the full Aspect design system, but there's no clean way to:
1. Use the components with a completely different set of brand tokens.
2. Avoid loading the default theme when you only want a specific alternate theme.

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Approach | Single headless entry point + BYO starter template | Minimal change, no breaking impact, KISS |
| Theme activation model | Keep `data-theme` as-is (default on `:root`, alternates via `[data-theme]`) | No breaking change for existing consumers |
| BYO contract | Starter template file with all tokens | Lowers barrier vs. just documenting the token list |
| Silent-wake theme | Promote from TFC app to shared design system | Reusable across consumers |

## Changes

### 1. New file: `packages/design-system/headless.css`

Token-free entry point. Imports everything except token files.

```css
@layer vendor, reset, tokens, utilities, components;

@import "./vendor.css";
@import "./reset.css";
@import "./utilities.css";
@import "./components.css";
```

The `tokens` layer is declared so consumer tokens slot into the correct cascade position, but no token values are set.

### 2. New file: `packages/design-system/tokens-custom-template.css`

Starter skeleton with every token the components depend on, grouped and commented. Uses the same `@layer tokens { :root { ... } }` pattern. Consumer copies this file, fills in their brand values.

The template must include **every** token defined in `tokens.css`. Token groups:

**Required (core components depend on these):**
- Base surfaces (`--color-background`, `--color-card`, `--color-popover`, `--color-secondary`, `--color-muted`)
- Borders & inputs (`--color-border`, `--color-input`)
- Text hierarchy (`--color-foreground`, `--color-card-foreground`, `--color-popover-foreground`, `--color-secondary-foreground`, `--color-muted-foreground`)
- Primary / accent (`--color-primary`, `--color-primary-foreground`, `--color-accent`, `--color-accent-foreground`, `--color-ring`)
- Dynamic accent (`--color-dynamic`)
- Semantic signals (`--color-destructive`, `--color-warning`, `--color-success`, `--color-info` + foregrounds)
- Spacing (`--spacing-xs` through `--spacing-2xl`)
- Typography (`--font-sans`, `--font-mono`, all `--font-size-*` and `--font-size-*--line-height` pairs)
- Container widths (`--container-xs` through `--container-5xl`)
- Layout (`--sidebar-width`)
- Control heights (`--control-sm`, `--control-md`, `--control-lg`)
- Border radius (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`)
- Shadows (`--shadow-sm`, `--shadow-md`, `--shadow-lg`)
- Glow + glass (`--glow-strength`, `--glass-strength`, `--glow-color`, `--glow-*`, `--glass-*`)
- Overlay & effects (`--overlay-scanline`, `--overlay-vignette`, `--stress-vignette-opacity`)
- Motion (`--duration-*`, `--ease-*`)
- Z-index (`--z-base`, `--z-above`, `--z-modal`, `--z-toast`)

**Optional (domain-specific, mark as such in template):**
- Extended alarms (`--color-alarm-breakdown`, `--color-alarm-degraded`, `--color-alarm-intermediate`, `--color-alarm-operational`, `--color-alarm-uncertain`, `--color-alarm-progress`, `--color-alarm-cyan`)
- Secondary palette (`--color-secondary-brick`, `--color-secondary-burnt-sienna`, etc.)
- Petroleum blue surface variants (`--color-surface-dark`, `--color-surface-dark-foreground`, `--color-surface-dark-muted`, `--color-surface-dark-inactive`)
- Map surfaces (`--color-map-*` — only needed for map components)

### 3. Promote silent-wake theme: `packages/design-system/tokens-silent-wake.css`

Move `apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css` into `packages/design-system/tokens-silent-wake.css`. The TFC-specific tokens (`--sw-sea-*-hex`) stay in the file — consumers that don't use Three.js simply ignore them.

**Fixes to apply during promotion:**
- Rename `data-theme` selector from `tfc-silent-wake` to `silent-wake` (drop the product prefix for the shared design system). Update the TFC app's `data-theme` attribute accordingly.
- Add missing token overrides for dark-on-dark correctness: `--color-popover-foreground` and `--color-secondary-foreground`.
- Remove `--radius-xl` (not defined in base tokens and unused by components). If it becomes needed later, add it to base `tokens.css` first.

### 4. Update `packages/design-system/index.css`

Add the silent-wake import:

```css
@layer vendor, reset, tokens, utilities, components;

@import "./vendor.css";
@import "./tokens.css";
@import "./tokens-steel-blue.css";  /* steel-blue + ocean themes */
@import "./tokens-silent-wake.css";
@import "./reset.css";
@import "./utilities.css";
@import "./components.css";
```

### 5. Update TFC app

Replace the local `themes-tfc-silent-wake.css` file. The TFC app should import the theme from the shared design system package instead of maintaining its own copy.

### 6. Update `docs/react-ui-consumption.md`

Document:
1. The existing all-in-one import (unchanged)
2. Pre-built theme activation via `data-theme` — now listing `steel-blue`, `ocean`, and `silent-wake`
3. The new headless + BYO path:
   ```css
   @import "@aspect/react-ui/design-system/headless.css";
   @import "./my-tokens.css";
   ```
4. Pointer to `tokens-custom-template.css` as a starting point for BYO consumers

### 7. CI / package exports

No changes needed. The `pack-react-ui` CI job already copies all `*.css` from `packages/design-system/` and the wildcard export (`./design-system/*.css`) covers all new files automatically.

**Note:** The CI `readdirSync` is non-recursive; all new CSS files must be placed directly in `packages/design-system/` (not subdirectories) to be included in the tarball.

## Consumer experience

### Pre-built theme (unchanged)
```css
@import "@aspect/react-ui/design-system.css";
```
Activate alternate themes with `data-theme="steel-blue"`, `data-theme="ocean"`, or `data-theme="silent-wake"` on `<html>`.

### BYO tokens
```css
@import "@aspect/react-ui/design-system/headless.css";
@import "./my-brand-tokens.css";
```

### Pre-built theme + selective import
```css
@import "@aspect/react-ui/design-system/headless.css";
@import "@aspect/react-ui/design-system/tokens-silent-wake.css";
```

## Caveats for BYO consumers

Components do **not** provide CSS fallback values (no `var(--color-primary, #000)`). If a token is missing, the property resolves to its CSS initial value (typically `transparent` for colors, `0` for lengths), which will break rendering.

BYO consumers should always start from `tokens-custom-template.css` and modify values rather than building a token sheet from scratch. The template is the authoritative contract for what tokens exist.

## Non-goals

- No CSS-in-JS or runtime theming API
- No changes to component internals (they already use CSS custom properties)
- No breaking changes to existing consumers
- No changes to the `data-theme` / `data-surface` / `data-effects` attribute conventions
