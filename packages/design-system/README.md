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

Two themes ship out of the box. Apply with a `data-theme` attribute on `<html>` or any ancestor:

```html
<!-- Default: dark steel-blue -->
<html>

<!-- Dark teal / golden-yellow -->
<html data-theme="ocean">
```

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
| `--color-background` | `oklch(13% 0.008 250)` | Page background |
| `--color-card` | `oklch(18% 0.008 250)` | Card / panel surface |
| `--color-primary` | `oklch(62% 0.10 245)` | Brand accent |
| `--color-foreground` | `oklch(92% 0 0)` | Body text |
| `--color-muted-foreground` | `oklch(55% 0.005 250)` | Secondary text |
| `--color-border` | `oklch(30% 0.010 250)` | Borders and dividers |
| `--color-destructive` | `oklch(55% 0.22 27)` | Error / danger |
| `--color-success` | `oklch(62% 0.15 155)` | Success |
| `--color-warning` | `oklch(72% 0.17 70)` | Warning |

### Spacing (4px grid)

`--spacing-xs` (4px) · `--spacing-sm` (8px) · `--spacing-md` (16px) · `--spacing-lg` (24px) · `--spacing-xl` (32px) · `--spacing-2xl` (48px)

### Controls

`--control-sm` (32px) · `--control-md` (36px) · `--control-lg` (40px)

### Border radius

`--radius-sm` (2px) · `--radius-md` (4px) · `--radius-lg` (6px) · `--radius-full` (9999px)

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
