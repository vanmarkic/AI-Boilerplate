# Design System Roadmap

Refinement plan benchmarked against 2026 industry best practices for homemade design systems.

Current state: 14 CSS files, 1,838 lines, OKLCH color space, 2 themes (default + ocean), `data-*` attribute variant API, CSS cascade layers.

---

## Critical Gaps

### 1. No Design Token Format Standard (W3C DTCG / Style Dictionary)

**Current state:** Tokens live exclusively in `tokens.css` as raw CSS custom properties (~80 tokens on `:root`, plus a full `[data-theme="ocean"]` override block).

**2026 standard:** The W3C Design Token Community Group format (`tokens.json`) is the lingua franca. Tools like Style Dictionary, Theo, and Cobalt consume it to generate platform outputs (CSS, iOS, Android, Figma variables). Raw CSS-only tokens are a dead-end for cross-platform consistency — you can't round-trip back to Figma or export to a native mobile spec.

**Concrete gap:**

- No `tokens.json` source of truth
- No generation script (the CSS is the source, not derived)
- No Figma variable sync possible
- Theming (glow-glass vs. none) is implemented via CSS cascade tricks instead of documented token sets
- Ocean theme (`[data-theme="ocean"]`) must also be captured in `tokens.json` as a separate token set

**Fix:** Add a `tokens/tokens.json` file in W3C DTCG format and generate `tokens.css` from it via Style Dictionary or a lightweight equivalent. The hand-authored CSS becomes a build artifact. Both the default and ocean theme token sets must be generated.

---

### 2. No `prefers-color-scheme` Light Mode

**Current state:** The system is dark-only with no light theme.

**2026 standard:** Every shipped design system includes at least `prefers-color-scheme: light` support, even if the app defaults to dark. Users on high-brightness displays, users with eye conditions, and enterprise procurement requirements all depend on it.

**Concrete gap:** The token architecture (deep OKLCH values as semantic names) makes adding a light theme a full rewrite of `:root` rather than a small file. This is the structural consequence of skipping the primitive/semantic separation.

---

### 3. Native `<dialog>` Not Used

**Current state:** `components-forms.css` has `.dialog-backdrop` and `.dialog-panel` targeting a `<div role="dialog">`. The Angular recipe creates the backdrop as a separate `<div aria-hidden="true">`.

**2026 standard:** The `<dialog>` HTML element has had 100% cross-browser support since mid-2022. The native element provides:

- Browser-managed focus trap on `showModal()`
- Native `::backdrop` pseudo-element (eliminate the `.dialog-backdrop` div entirely)
- `close` event
- `inert` attribute automatically applied to background content
- Escape key handling built-in

**Fix:** `.dialog-backdrop` -> `dialog::backdrop` in `components-forms.css`. Angular component migrated to `<dialog>` with `showModal()`, removing `CdkTrapFocus` and the `(keydown.escape)` host listener.

---

### 4. No `:where()` for Zero-Specificity Component Resets

**Current state:** Component selectors like `.btn`, `.card`, `.badge` carry specificity of `(0,1,0)`. There are ~40+ component selectors across 8 CSS files (`components-buttons.css`, `components-forms.css`, `components-panels.css`, `components-data-viz.css`, `components-layout.css`, `components-table.css`, `components-table-filter.css`, `components-tabs.css`).

**2026 standard:** Wrapping selectors in `:where()` within the `components` layer reduces specificity to `(0,0,0)`, meaning any consumer rule overrides them without `!important`. This is now standard in Shoelace, Open Props, and Panda CSS:

```css
@layer components {
  :where(.btn) { ... }
  :where(.card) { ... }
}
```

**Breaking change note:** Consumer CSS that relied on component selectors having specificity `(0,1,0)` to tie-break against their own `(0,1,0)` rules will see changed behavior. In practice this is a net improvement (easier overrides), but it must be documented in the changelog. Audit `apps/main/frontend` and `apps/tfc/frontend` for any custom overrides of design system classes before migrating.

---

## Significant Improvements

### 5. Primitive Token Tier Missing

Tokens jump directly from raw OKLCH values to semantic names. Industry standard (Radix Themes, Primer Design Tokens, Google Material You) uses three tiers:

```
primitive: --blue-600: oklch(62% 0.10 245)
semantic:  --color-primary: var(--blue-600)
component: --button-bg: var(--color-primary)
```

The absence of component-level tokens means you can't theme a single component type without touching the global semantic scope.

---

### 6. `--font-size-*--line-height` Naming Convention Is Non-Standard

**Current state:** `--font-size-sm--line-height: 1.25rem` (double-dash BEM-style pairing). There are 10 such tokens in `tokens.css`.

**2026 standard:** The conventional approach is independent named scales:

```css
--line-height-tight: 1.25rem;
--line-height-snug: 1.375rem;
--line-height-normal: 1.5rem;
--line-height-relaxed: 1.625rem;
--line-height-loose: 2rem;
```

**Fix:** Add `--line-height-*` tokens. Keep old ones as deprecated backward-compat aliases with a comment. Update all internal usages in `reset.css` and component files (~10 references).

---

### 7. No Universal `:focus-visible` Baseline in Reset

**Current state:** `.btn`, `.input-base`, `.collapsible-panel-trigger`, `.card-group-toggle`, `.tree-filter-toggle`, `.tree-filter-input`, and `.data-table-row[data-clickable]` each define their own focus rings. But `select`, `textarea`, link elements, and any custom interactive element are uncovered.

**2026 standard (WCAG 2.2 SC 2.4.11 Focus Appearance, Level AA):** The reset layer must include a universal focus-visible baseline:

```css
@layer reset {
  :focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }
}
```

Individual components then override to their preferred ring style if needed.

---

### 8. `@property` Not Used for Animatable Custom Properties

**Current state:** `--glow-strength` and `--glass-strength` are plain custom properties. Browsers can't interpolate them between 0 and 1 in a CSS `transition` — they jump instantly.

**Fix:**

```css
@property --glow-strength {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}
@property --glass-strength {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}
```

Wide browser support: Chrome 85+, Firefox 128+, Safari 16.4+.

---

### 9. No Container Queries in Layout Components

**Current state:** Utilities like `.flex`, `.grid`, `.gap-md` have no responsive variants. Layout components rely on viewport media queries implicitly via consumers.

**2026 standard:** Since this system explicitly avoids Tailwind, container queries are the right answer. Target components for `@container`:

- `.sidebar-layout` — collapse sidebar below a threshold
- `.page-layout` — adjust content area padding
- `.card-group` — switch grid column count based on container width
- `.grid` — responsive column adjustment

---

## Things to Keep (Already Best-in-Class)

| Practice                                                       | Why it's right                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `@layer vendor, reset, tokens, utilities, components`          | Correct W3C cascade layer order. No `!important` needed.                               |
| OKLCH color space throughout                                   | Perceptually uniform, HDR-capable. Ahead of most large design systems still using HSL. |
| `data-*` attribute variant API                                 | Zero runtime class computation. Works with any framework or vanilla HTML.              |
| `color-mix(in oklch, ...)` for hover states                    | Eliminates separate hover tokens. Stays in perceptual color space.                     |
| `prefers-reduced-motion` and `prefers-contrast`                | Both reduce and disable glow/glass effects. Correct implementation.                    |
| Explicit `@layer` declarations before `@import`                | Required per spec to prevent layer reordering surprises.                               |
| CSS-only (no JS, no preprocessor)                              | Zero runtime overhead, works everywhere, no build step for consumers.                  |
| Logical properties (`padding-inline`, `margin-block`, `inset`) | Full RTL and vertical writing mode support baked in.                                   |
| `vendor.css` layer placeholder                                 | Correctly placed at lowest cascade priority; well-documented intent.                   |

---

## Implementation Tiers

Items are grouped by dependency. Complete each tier before starting the next.

### Tier 1 — Standalone Quick Wins

No dependencies on other items. Can be done in any order or in parallel.

| Item                                                   | Size | Files                                               | Acceptance Criteria                                                                                                                                       |
| ------------------------------------------------------ | ---- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@property` for `--glow-strength` / `--glass-strength` | XS   | `tokens.css`                                        | `transition: --glow-strength 250ms` interpolates smoothly in Chrome, Firefox, Safari.                                                                     |
| Universal `:focus-visible` in reset                    | XS   | `reset.css`                                         | All interactive elements (links, buttons, inputs, custom elements) show a 2px ring on keyboard focus. Existing component overrides still work.            |
| `--line-height-*` independent token scale              | S    | `tokens.css`, `reset.css`, ~10 component references | New `--line-height-*` tokens exist. Old `--font-size-*--line-height` tokens kept as aliases with `/* deprecated */` comment. All internal usages updated. |

### Tier 2 — Standalone Broader Scope

No dependencies on Tier 1 or each other, but larger in scope.

| Item                              | Size | Files                                                               | Acceptance Criteria                                                                                                                                          |
| --------------------------------- | ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `:where()` wrapping               | M    | 8 `components-*.css` files (~40+ selectors)                         | All component root selectors wrapped in `:where()`. Consumer overrides with a single class selector win without `!important`. No visual regressions in apps. |
| Native `<dialog>` migration       | M    | `components-forms.css`, `packages/ui/src/dialog-panel.component.ts` | `.dialog-backdrop` class removed, replaced with `dialog::backdrop`. Angular component uses `<dialog>` element with `showModal()`. `CdkTrapFocus` removed.    |
| `@container` in layout components | M    | `components-layout.css`, `components-forms.css`                     | `.sidebar-layout`, `.page-layout`, `.card-group`, `.grid` use `@container` for intrinsic responsiveness.                                                     |

### Tier 3 — Chained (Must Execute in Order)

Each item depends on the previous one.

```
tokens.json  -->  Primitive token tier  -->  Light mode
```

| Item                                | Size | Files                                                                           | Acceptance Criteria                                                                                                                                             |
| ----------------------------------- | ---- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens/tokens.json` (W3C DTCG)     | L    | New `tokens/tokens.json`, `tokens/config.js`, `tokens.css` becomes build output | `npm run build:tokens` generates `tokens.css` identical to current output. Both default and ocean themes in `tokens.json`.                                      |
| Primitive token tier                | L    | `tokens.json` restructured, `tokens.css` regenerated                            | Three tiers visible: primitive (`--blue-600`), semantic (`--color-primary`), component (`--button-bg`). Existing semantic tokens unchanged for backward compat. |
| `prefers-color-scheme: light` theme | L    | `tokens.json` (new light set), `tokens.css` (generated)                         | Light mode activates via `prefers-color-scheme: light` or `data-theme="light"`. All ~50 color tokens have light equivalents. WCAG AA contrast ratios met.       |
