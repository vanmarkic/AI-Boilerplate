# @aspect/design-system

Framework-agnostic CSS design system — OKLCH tokens, reset, utilities, and component classes.

Works with any framework. Styled with native CSS layers so your overrides always win.

## Installation

```sh
npm install @aspect/design-system
```

## Usage

### Full system (recommended)

```css
@import "@aspect/design-system";
```

This loads everything in the correct layer order: `vendor → reset → tokens → utilities → components`.

### Selective imports

```css
@import "@aspect/design-system/tokens.css";     /* CSS custom properties only */
@import "@aspect/design-system/reset.css";      /* opinionated reset */
@import "@aspect/design-system/utilities.css";  /* utility classes */
@import "@aspect/design-system/components.css"; /* component classes */
```

## Theming

### Built-in themes

Three themes ship out of the box. Apply with a `data-theme` attribute on `<html>` or any ancestor:

```html
<!-- Default: Naval Group Corporate (light) -->
<html>

<!-- Dark steel-blue -->
<html data-theme="steel-blue">

<!-- Dark teal / golden-yellow -->
<html data-theme="ocean">
```

#### Default — Naval Group Corporate (light)

The default theme is a light-dominant palette based on the Naval Group Kit UI V1 guideline. Uses Source Sans Pro, petroleum blue (`#0E2C49`) for text and dark surfaces, and `#164194` as the active/primary accent.

The theme follows the 25/75 rule: ~25% petroleum blue surfaces (header, sidebar) and ~75% light backgrounds. Use `data-surface="dark"` on containers that should flip to the dark petroleum blue variant:

```html
<html>
  <header data-surface="dark"><!-- petroleum blue header --></header>
  <main><!-- light background content --></main>
</html>
```

Extra tokens available in this theme:
- `--color-dynamic` — red accent (`#E1051E`)
- `--color-alarm-*` — 7 alarm/alert levels (breakdown, degraded, intermediate, operational, uncertain, progress, cyan)
- `--color-secondary-*` — 10 named secondary colors (brick, burnt-sienna, brown, khaki, olive, cyan, electric-blue, bluish-grey, lavender, purple)
- `--color-surface-dark` / `--color-surface-dark-foreground` / `--color-surface-dark-muted` / `--color-surface-dark-inactive` — petroleum blue surface palette

### Built-in effects

Glow and glass effects are off by default and toggled with `data-effects`:

```html
<!-- Enable glow + glassmorphism -->
<html data-effects="glow-glass">

<!-- Explicitly disable (e.g. opt-out in a subsection) -->
<div data-effects="none">
```

Effects respect `prefers-reduced-motion` and `prefers-contrast: more` — they are automatically disabled.

## Customisation

### Override tokens

All design decisions are CSS custom properties. Override them after the import — no specificity fights because tokens live in `@layer tokens` and unlayered CSS always wins:

```css
@import "@aspect/design-system";

:root {
  --color-primary: oklch(70% 0.18 140); /* swap accent to green */
  --radius-md: 8px;                     /* rounder corners */
  --font-sans: "Geist", system-ui, sans-serif;
}
```

### Create a custom theme

Scope token overrides to a `data-theme` value:

```css
@import "@aspect/design-system";

[data-theme="brand"] {
  --color-primary:            oklch(65% 0.20 30);  /* orange */
  --color-background:         oklch(98% 0.005 250);
  --color-foreground:         oklch(15% 0 0);
  --color-card:               oklch(94% 0.005 250);
  --color-border:             oklch(85% 0.005 250);
  --color-muted-foreground:   oklch(50% 0.005 250);
}
```

```html
<html data-theme="brand">
```

### Override component styles

Component classes live in `@layer components`. Any unlayered CSS overrides them — no `!important` needed:

```css
@import "@aspect/design-system";

/* Pill buttons everywhere */
.btn { border-radius: var(--radius-full); }

/* Tighter table cells */
.table-cell { padding-block: var(--spacing-xs); }
```

### Replace components entirely

Import only tokens and utilities, skip `components.css`, and write your own classes:

```css
@import "@aspect/design-system/tokens.css";
@import "@aspect/design-system/reset.css";
@import "@aspect/design-system/utilities.css";

/* Your own component classes using the token vocabulary */
.my-button {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  border-radius: var(--radius-md);
  height: var(--control-md);
  padding-inline: var(--spacing-md);
}
```

## Token reference

### Colors

| Token | Default | Purpose |
|---|---|---|
| `--color-background` | `oklch(100% 0 0)` | Page background (#FFFFFF) |
| `--color-card` | `oklch(96.6% 0.003 229)` | Card / panel surface (#F2F4F5) |
| `--color-primary` | `oklch(40% 0.145 262)` | Brand accent (#164194) |
| `--color-foreground` | `oklch(28.7% 0.064 250)` | Body text (#0E2C49) |
| `--color-muted-foreground` | `oklch(55% 0.020 250)` | Secondary text |
| `--color-border` | `oklch(85% 0.010 240)` | Borders and dividers |
| `--color-destructive` | `oklch(64.9% 0.216 26)` | Error / danger (#F74343) |
| `--color-success` | `oklch(76.9% 0.202 143)` | Success (#54D354) |
| `--color-warning` | `oklch(75.6% 0.153 54)` | Warning (#F99246) |

### Spacing (4px grid)

`--spacing-xs` (4px) · `--spacing-sm` (8px) · `--spacing-md` (16px) · `--spacing-lg` (24px) · `--spacing-xl` (32px) · `--spacing-2xl` (48px)

### Controls

`--control-sm` (28px) · `--control-md` (32px) · `--control-lg` (40px)

### Border radius

`--radius-sm` (1.5px) · `--radius-md` (1.5px) · `--radius-lg` (1.5px) · `--radius-full` (9999px)

### Effects

| Token | Default | Purpose |
|---|---|---|
| `--glow-strength` | `0` | Glow intensity multiplier (0–1) |
| `--glass-strength` | `0` | Glass blur intensity multiplier (0–1) |

## Component classes

Classes emitted by `@aspect/react-ui` components — usable directly in any framework:

| Class | Component | Key attributes |
|---|---|---|
| `.btn` | Button | `data-variant` (default / destructive / outline / ghost), `data-size` (sm / default / lg) |
| `.badge` | Badge | `data-variant` (default / secondary / destructive / outline) |
| `.stack` | Stack | `data-direction` (vertical / horizontal), `data-gap`, `data-align`, `data-justify` |
| `.layout-grid` | Grid | `--grid-cols` CSS var, `data-gap` |
| `.page-layout` | PageLayout | — |
| `.sidebar-layout` | — | `data-side` (left / right) |
| `.page-header` | PageHeader | — |
| `.drawer-panel` | — | `data-side` (left / right), `data-state` (open / closed) |
