# React UI Theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow consumers of the `@aspect/react-ui` package to pick their design system — pre-built themes or bring-your-own tokens.

**Architecture:** Add a headless CSS entry point (no tokens) alongside the existing all-in-one entry point. Ship a BYO token template. Promote the TFC silent-wake theme to the shared design system.

**Tech Stack:** CSS custom properties, CSS `@layer`, OKLCH color space

**Spec:** `docs/superpowers/specs/2026-04-01-react-ui-theming-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/design-system/headless.css` | Token-free entry point (reset + utilities + components) |
| Create | `packages/design-system/tokens-custom-template.css` | BYO starter skeleton with all tokens |
| Create | `packages/design-system/tokens-silent-wake.css` | Promoted silent-wake theme (renamed from `tfc-silent-wake`) |
| Modify | `packages/design-system/index.css` | Add silent-wake import |
| Modify | `apps/tfc/frontend/src/styles.css:17` | Replace local theme import with design-system import |
| Delete | `apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css` | Replaced by shared package version |
| Modify | `apps/tfc/frontend/src/index.html:2` | Rename `data-theme` from `tfc-silent-wake` to `silent-wake` |
| Modify | `apps/tfc/frontend/src/app/shared/components-silent-wake.css` | Update all `[data-theme="tfc-silent-wake"]` selectors to `[data-theme="silent-wake"]` |
| Modify | `docs/react-ui-consumption.md` | Document theming options |

---

### Task 1: Create headless entry point

**Files:**
- Create: `packages/design-system/headless.css`

- [ ] **Step 1: Create `headless.css`**

```css
/* @aspect/design-system — headless (no tokens)
 * Import this when providing your own design tokens.
 * The tokens layer is declared but empty — your token file
 * slots into it via @layer tokens { :root { ... } }.
 *
 * Usage:
 *   @import "@aspect/react-ui/design-system/headless.css";
 *   @import "./my-brand-tokens.css";
 */

@layer vendor, reset, tokens, utilities, components;

@import "./vendor.css";
@import "./reset.css";
@import "./utilities.css";
@import "./components.css";
```

- [ ] **Step 2: Verify it parses correctly**

Run: `node -e "const fs = require('fs'); const css = fs.readFileSync('packages/design-system/headless.css','utf8'); console.log('OK:', css.includes('@layer') && css.includes('@import'));"`
Expected: `OK: true`

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/headless.css
git commit -m "feat(design-system): add headless entry point for BYO theming"
```

---

### Task 2: Create BYO token template

**Files:**
- Create: `packages/design-system/tokens-custom-template.css`
- Reference: `packages/design-system/tokens.css` (copy all tokens from here)

- [ ] **Step 1: Create `tokens-custom-template.css`**

Copy every token from `packages/design-system/tokens.css` into a template file. Replace all values with `/* TODO */` placeholder comments. Split into Required and Optional sections. Use the exact same `@layer tokens { :root { ... } }` structure.

Required tokens (grouped):
- Base surfaces: `--color-background`, `--color-card`, `--color-popover`, `--color-secondary`, `--color-muted`
- Borders & inputs: `--color-border`, `--color-input`
- Text: `--color-foreground`, `--color-card-foreground`, `--color-popover-foreground`, `--color-secondary-foreground`, `--color-muted-foreground`
- Primary / accent: `--color-primary`, `--color-primary-foreground`, `--color-accent`, `--color-accent-foreground`, `--color-ring`
- Dynamic accent: `--color-dynamic`
- Semantic signals: `--color-destructive`, `--color-destructive-foreground`, `--color-warning`, `--color-warning-foreground`, `--color-success`, `--color-success-foreground`, `--color-info`, `--color-info-foreground`
- Spacing: `--spacing-xs` through `--spacing-2xl`
- Typography: `--font-sans`, `--font-mono`, all `--font-size-*` and `--font-size-*--line-height` pairs
- Container widths: `--container-xs` through `--container-5xl`
- Layout: `--sidebar-width`
- Control heights: `--control-sm`, `--control-md`, `--control-lg`
- Border radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- Glow + glass: `--glow-strength`, `--glass-strength`, `--glow-color`, `--glow-sm`, `--glow-primary`, `--glow-lg`, `--glow-xl`, `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`
- Overlay & effects: `--overlay-scanline`, `--overlay-vignette`, `--stress-vignette-opacity`
- Motion: `--duration-fast`, `--duration-normal`, `--duration-slow`, `--duration-emphasis`, `--duration-scenic`, `--ease-default`, `--ease-spring`, `--ease-out-expo`, `--ease-in-out-back`
- Z-index: `--z-base`, `--z-above`, `--z-modal`, `--z-toast`

Optional tokens (mark with `/* Optional — ... */` comments):
- Extended alarms: `--color-alarm-breakdown`, `--color-alarm-degraded`, `--color-alarm-intermediate`, `--color-alarm-operational`, `--color-alarm-uncertain`, `--color-alarm-progress`, `--color-alarm-cyan`
- Secondary palette: `--color-secondary-brick` through `--color-secondary-purple` (10 tokens)
- Petroleum blue surface: `--color-surface-dark`, `--color-surface-dark-foreground`, `--color-surface-dark-muted`, `--color-surface-dark-inactive`
- Map surfaces: `--color-map-background`, `--color-map-land`, `--color-map-water`, `--color-map-roads`, `--color-map-buildings`, `--color-map-labels`

- [ ] **Step 2: Verify token count matches `tokens.css`**

Run: `grep -c "^\s*--" packages/design-system/tokens.css && grep -c "^\s*--" packages/design-system/tokens-custom-template.css`
Expected: Both numbers should match (the template has every token from the source).

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/tokens-custom-template.css
git commit -m "feat(design-system): add BYO token template for custom theming"
```

---

### Task 3: Promote silent-wake theme to shared design system

**Files:**
- Create: `packages/design-system/tokens-silent-wake.css` (from `apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css`)
- Delete: `apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css`

- [ ] **Step 1: Copy theme file to design system**

Copy `apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css` to `packages/design-system/tokens-silent-wake.css`.

- [ ] **Step 2: Apply fixes to `tokens-silent-wake.css`**

In the new `packages/design-system/tokens-silent-wake.css`:

a) Rename selector from `[data-theme="tfc-silent-wake"]` to `[data-theme="silent-wake"]`.

b) Update header comment: change `Activate with data-theme="tfc-silent-wake"` to `Activate with data-theme="silent-wake"`. Change `TFC Silent Wake Theme` to `Silent Wake Theme (dark)`.

c) Add missing foreground overrides after the existing `--color-muted-foreground` line:
```css
    --color-popover-foreground: oklch(98% 0 0);
    --color-secondary-foreground: oklch(85% 0 0);
```

d) Remove `--radius-xl: 1.5rem;` (not defined in base tokens).

- [ ] **Step 3: Delete old file**

```bash
git rm apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css
```

- [ ] **Step 4: Commit**

```bash
git add packages/design-system/tokens-silent-wake.css
git commit -m "feat(design-system): promote silent-wake theme from TFC app to shared package"
```

---

### Task 4: Update design system index and TFC app imports

**Files:**
- Modify: `packages/design-system/index.css:3-4` — add silent-wake import
- Modify: `apps/tfc/frontend/src/styles.css:17` — replace local import
- Modify: `apps/tfc/frontend/src/index.html:2` — rename data-theme
- Modify: `apps/tfc/frontend/src/app/shared/components-silent-wake.css` — rename all selectors

- [ ] **Step 1: Add silent-wake import to `index.css`**

In `packages/design-system/index.css`, add the import after `tokens-steel-blue.css`:

```css
@import "./tokens-steel-blue.css";
@import "./tokens-silent-wake.css";
```

The full file becomes:
```css
@layer vendor, reset, tokens, utilities, components;

@import "./vendor.css";
@import "./tokens.css";
@import "./tokens-steel-blue.css";
@import "./tokens-silent-wake.css";
@import "./reset.css";
@import "./utilities.css";
@import "./components.css";
```

- [ ] **Step 2: Update TFC `styles.css`**

In `apps/tfc/frontend/src/styles.css`, line 17, replace:
```css
@import "./app/shared/themes-tfc-silent-wake.css";
```
with nothing — remove the line entirely. The theme now comes from `@import "@aspect/design-system"` on line 1.

- [ ] **Step 3: Update TFC `index.html`**

In `apps/tfc/frontend/src/index.html`, line 2, change:
```html
<html lang="en" data-theme="tfc-silent-wake">
```
to:
```html
<html lang="en" data-theme="silent-wake">
```

- [ ] **Step 4: Rename selectors in `components-silent-wake.css`**

In `apps/tfc/frontend/src/app/shared/components-silent-wake.css`, replace all occurrences of `data-theme="tfc-silent-wake"` with `data-theme="silent-wake"`. There are approximately 50+ occurrences. Use find-and-replace across the entire file.

Also update the header comment on line 2 from:
```
Visual overrides scoped to [data-theme="tfc-silent-wake"].
```
to:
```
Visual overrides scoped to [data-theme="silent-wake"].
```

Also replace the 2 occurrences of `var(--radius-xl)` with `1.5rem` (lines 143 and 370). The `--radius-xl` token was removed from `tokens-silent-wake.css` in Task 3 because it's not in the base token set, so these references would break.

- [ ] **Step 5: Verify no remaining references to `tfc-silent-wake`**

Run: `grep -r "tfc-silent-wake" apps/tfc/ packages/design-system/ --exclude="CHANGE_REPORT.md"`
Expected: No matches. (Historical references in `CHANGE_REPORT.md` and doc/spec files are fine.)

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/index.css apps/tfc/frontend/src/styles.css apps/tfc/frontend/src/index.html apps/tfc/frontend/src/app/shared/components-silent-wake.css
git commit -m "refactor: rename tfc-silent-wake to silent-wake, wire up shared theme"
```

---

### Task 5: Update consumption docs

**Files:**
- Modify: `docs/react-ui-consumption.md`

- [ ] **Step 1: Update the Design system CSS section**

Replace the current "Design system CSS" section (lines 70-86) in `docs/react-ui-consumption.md` with:

```markdown
### Design system CSS

The full design system (tokens, reset, utilities, components) is bundled in the tarball.

#### All-in-one (includes default theme + all alternate themes)

\`\`\`css
@import "@aspect/react-ui/design-system.css";
\`\`\`

This loads the default Naval Group Corporate light theme on `:root`. Activate alternate themes by setting `data-theme` on `<html>` or any container:

| Theme | Attribute | Style |
|-------|-----------|-------|
| Default (Naval Group) | *(none — active on `:root`)* | Light, petroleum blue |
| Steel Blue | `data-theme="steel-blue"` | Dark, steel-blue accent |
| Ocean | `data-theme="ocean"` | Dark teal, golden-yellow accent |
| Silent Wake | `data-theme="silent-wake"` | Dark navy, blue glow accent |

#### Individual layers

\`\`\`css
@import "@aspect/react-ui/design-system/tokens.css";
@import "@aspect/react-ui/design-system/reset.css";
@import "@aspect/react-ui/design-system/utilities.css";
@import "@aspect/react-ui/design-system/components.css";
\`\`\`

#### Bring your own tokens (headless)

Use the components with your own design tokens:

\`\`\`css
@import "@aspect/react-ui/design-system/headless.css";
@import "./my-brand-tokens.css";
\`\`\`

The headless entry point includes reset, utilities, and component styles but **no tokens**. The `tokens` CSS layer is declared but empty — your token file slots into it.

Start from the template for a complete list of tokens to define:

\`\`\`css
/* Copy and customize: */
@import "@aspect/react-ui/design-system/tokens-custom-template.css";
\`\`\`

Components do not provide CSS fallback values. If a token is missing, the property resolves to its CSS initial value (typically `transparent` for colors), which will break rendering. Always start from the template.
```

- [ ] **Step 2: Update the AI agent context section**

In the "AI agent context" section at the bottom, append after the existing text:

```markdown
The library supports three theming modes: (1) all-in-one import with `data-theme` attribute switching, (2) individual layer imports for fine control, (3) headless import + custom tokens for full BYO theming. See the "Design system CSS" section above.
```

- [ ] **Step 3: Commit**

```bash
git add docs/react-ui-consumption.md
git commit -m "docs: update react-ui consumption guide with theming options"
```

---

### Task 6: Final verification

- [ ] **Step 1: Verify all new files exist**

Run: `ls -la packages/design-system/headless.css packages/design-system/tokens-custom-template.css packages/design-system/tokens-silent-wake.css`
Expected: All three files exist.

- [ ] **Step 2: Verify old file is gone**

Run: `ls apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css 2>&1`
Expected: `No such file or directory`

- [ ] **Step 3: Verify no stale references**

Run: `grep -r "tfc-silent-wake" apps/ packages/ docs/react-ui-consumption.md --exclude="CHANGE_REPORT.md"`
Expected: No matches. (Historical references in `CHANGE_REPORT.md` are fine.)

- [ ] **Step 4: Verify `index.css` imports are correct**

Run: `cat packages/design-system/index.css`
Expected: Shows `tokens-silent-wake.css` import between `tokens-steel-blue.css` and `reset.css`.

- [ ] **Step 5: Run TFC frontend build (if available)**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds (no missing CSS imports).
