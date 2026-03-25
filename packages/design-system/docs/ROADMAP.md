# Design System Roadmap

Refinement plan benchmarked against 2026 industry best practices for homemade design systems.

---

## 🔴 Critical Gaps

### 1. No Design Token Format Standard (W3C DTCG / Style Dictionary)

**Current state:** Tokens live exclusively in `tokens.css` as raw CSS custom properties.

**2026 standard:** The W3C Design Token Community Group format (`tokens.json`) is now the lingua franca. Tools like Style Dictionary, Theo, and Cobalt consume it to generate platform outputs (CSS, iOS, Android, Figma variables). Raw CSS-only tokens are a dead-end for cross-platform consistency — you can't round-trip back to Figma or export to a native mobile spec.

**Concrete gap:**
- No `tokens.json` source of truth
- No generation script (the CSS is the source, not derived)
- No Figma variable sync possible
- Theming (glow-glass vs. none) is implemented via CSS cascade tricks instead of documented token sets

**Fix:** Add a `tokens/tokens.json` file in W3C DTCG format and generate `tokens.css` from it via Style Dictionary or a lightweight equivalent. The hand-authored CSS becomes a build artifact.

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

**Fix:** `.dialog-backdrop` → `dialog::backdrop` in `components-forms.css`. Angular component migrated to `<dialog>` with `showModal()`, removing `CdkTrapFocus` and the `(keydown.escape)` host listener.

---

### 4. No `:where()` for Zero-Specificity Component Resets

**Current state:** Component selectors like `.btn`, `.card`, `.badge` carry specificity of `(0,1,0)`.

**2026 standard:** Wrapping selectors in `:where()` within the `components` layer reduces specificity to `(0,0,0)`, meaning any consumer rule overrides them without `!important`. This is now standard in Shoelace, Open Props, and Panda CSS:

```css
@layer components {
  :where(.btn) { ... }
  :where(.card) { ... }
}
```

---

## 🟡 Significant Improvements

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

**Current state:** `--font-size-sm--line-height: 1.25rem` (double-dash BEM-style pairing)

**2026 standard:** Nobody else does it this way. The conventional approach is independent named scales:

```css
--line-height-tight:   1.25rem;
--line-height-snug:    1.375rem;
--line-height-normal:  1.5rem;
--line-height-relaxed: 1.625rem;
--line-height-loose:   2rem;
```

**Fix:** Add `--line-height-*` tokens; keep old ones as deprecated backward-compat aliases; update all internal usages.

---

### 7. No Universal `:focus-visible` Baseline in Reset

**Current state:** `.btn`, `.input-base`, `.collapsible-panel-trigger` each define their own `outline: none` + box-shadow focus rings. But `select`, `textarea`, link elements, and any custom interactive element are uncovered.

**2026 standard (WCAG 2.2 SC 2.4.11 Focus Appearance — Level AA):** The reset layer must include a universal focus-visible baseline:

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
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}
@property --glass-strength {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}
```

Wide browser support: Chrome 85+, Firefox 128+, Safari 16.4+.

---

### 9. No Container Queries in Layout Components

**Current state:** Utilities like `.flex`, `.grid`, `.gap-md` have no responsive variants. Layout components rely on viewport media queries implicitly via consumers.

**2026 standard:** Since this system explicitly avoids Tailwind, container queries are the right answer. Components like `.stack`, `.layout-grid`, and `.card` should use `@container` internally for intrinsic responsiveness rather than relying on viewport breakpoints.

---

## 🟢 Things to Keep (Already Best-in-Class)

| Practice | Why it's right |
|---|---|
| `@layer vendor, reset, tokens, utilities, components` | Correct W3C cascade layer order. No `!important` needed. |
| OKLCH color space throughout | Perceptually uniform, HDR-capable. Ahead of most large design systems still using HSL. |
| `data-*` attribute variant API | Zero runtime class computation. Works with any framework or vanilla HTML. |
| `color-mix(in oklch, ...)` for hover states | Eliminates separate hover tokens. Stays in perceptual color space. |
| `prefers-reduced-motion` and `prefers-contrast` | Both reduce and disable glow/glass effects. Correct implementation. |
| Explicit `@layer` declarations before `@import` | Required per spec to prevent layer reordering surprises. |
| CSS-only (no JS, no preprocessor) | Zero runtime overhead, works everywhere, no build step for consumers. |
| Logical properties (`padding-inline`, `margin-block`, `inset`) | Full RTL and vertical writing mode support baked in. |
| `vendor.css` layer placeholder | Correctly placed at lowest cascade priority; well-documented intent. |

---

## Priority Order for Implementation

- [ ] **`@property` for `--glow-strength` / `--glass-strength`** — 2-line fix, unlocks CSS transition interpolation on glow/glass effects
- [ ] **Universal `:focus-visible` in `reset.css`** — WCAG 2.2 AA compliance, 3 lines
- [ ] **`:where()` wrapping across all `@layer components` selectors** — zero-specificity consumer overrides without `!important`
- [ ] **`--line-height-*` independent token scale** — add new tokens, deprecate `--font-size-*--line-height` pattern, update internal usage
- [ ] **Native `<dialog>` migration** — replace `.dialog-backdrop` div with `dialog::backdrop`, update Angular component to use `showModal()`, remove `CdkTrapFocus`
- [ ] **`tokens/tokens.json` in W3C DTCG format** — source of truth; `tokens.css` becomes a build artifact from Style Dictionary
- [ ] **Primitive token tier** — prerequisite for safe per-component theming and light mode
- [ ] **`prefers-color-scheme: light` theme** — completes accessible baseline; requires primitive tier first
- [ ] **`@container` queries in layout components** — modern intrinsic responsive design
