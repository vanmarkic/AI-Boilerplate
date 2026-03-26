# Silent Wake Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `tfc-silent-wake` CSS theme that gives the TFC frontend a dark navy / slate / blue aesthetic matching the reference design, without changing any Angular templates or game logic.

**Architecture:** Two new CSS files — a `@layer tokens` file for the color palette/radius/glow and a `@layer components` file for visual overrides (rounding, typography, scanline suppression). One small TS fix for the sea backdrop's oklch parsing bug. All scoped under `[data-theme="tfc-silent-wake"]`.

**Tech Stack:** CSS custom properties (oklch), CSS layers, Angular, Three.js

**Spec:** `docs/superpowers/specs/2026-03-26-silent-wake-theme-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css` | Create | Token layer: colors, glow, glass, radius, scanlines, sea hex fallbacks |
| `apps/tfc/frontend/src/app/shared/components-silent-wake.css` | Create | Component overrides: typography, cards, panels, badges, headers, forms |
| `apps/tfc/frontend/src/styles.css` | Modify (line 16) | Add 2 imports at end |
| `apps/tfc/frontend/src/app/features/home/sea-backdrop.ts` | Modify (lines 80-87) | Fix oklch parsing, read hex fallback tokens |
| `apps/tfc/frontend/src/app/features/home/sea-lightning.ts` | Modify (line 16) | Read lightning hex fallback token |

---

### Task 1: Create Token Theme File

**Files:**
- Create: `apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css`

- [ ] **Step 1: Create the token file**

Write the full `@layer tokens` block with all color, glow, glass, radius, and scanline tokens. Follow the exact structure from `themes-tfc-domains.css` (the existing theme file at line 8-193).

```css
/* ── TFC Silent Wake Theme ──────────────────────────────
 *  Dark navy / slate / blue aesthetic.
 *  Activate with data-theme="tfc-silent-wake" on <html>.
 * ──────────────────────────────────────────────────────── */

@layer tokens {
  [data-theme="tfc-silent-wake"] {
    /* ── Surfaces ────────────────────────────────────── */
    --color-background: oklch(8% 0.02 250);
    --color-card: oklch(15% 0.02 250);
    --color-popover: oklch(19% 0.02 250);
    --color-secondary: oklch(30% 0.015 250);
    --color-muted: oklch(28% 0.015 250);
    --color-border: oklch(25% 0.015 250);
    --color-input: oklch(5% 0.02 250);

    /* ── Text ────────────────────────────────────────── */
    --color-foreground: oklch(98% 0 0);
    --color-card-foreground: oklch(98% 0 0);
    --color-muted-foreground: oklch(60% 0.015 250);

    /* ── Primary / Accent ────────────────────────────── */
    --color-primary: oklch(55% 0.22 260);
    --color-primary-foreground: oklch(98% 0 0);
    --color-accent: oklch(78% 0.12 250);
    --color-accent-foreground: oklch(8% 0.02 250);
    --color-ring: oklch(55% 0.22 260);

    /* ── Radius (rounder than tactical themes) ───────── */
    --radius-sm: 0.5rem;
    --radius-md: 0.75rem;
    --radius-lg: 1rem;
    --radius-xl: 1.5rem;

    /* ── Scanlines (disabled) ────────────────────────── */
    --overlay-scanline: transparent;

    /* ── Glow + Glass (blue, uses calc for a11y) ─────── */
    --glow-strength: 1;
    --glass-strength: 1;
    --glow-color: oklch(55% 0.22 260);
    --glow-sm: 0 0 14px oklch(55% 0.22 260 / calc(0.5 * var(--glow-strength)));
    --glow-primary: 0 0 28px
      oklch(55% 0.22 260 / calc(0.75 * var(--glow-strength)));
    --glow-lg: 0 0 48px oklch(55% 0.22 260 / calc(1 * var(--glow-strength)));
    --glow-xl:
      0 0 72px oklch(55% 0.22 260 / calc(0.6 * var(--glow-strength))),
      0 0 120px oklch(55% 0.22 260 / calc(0.25 * var(--glow-strength)));
    --glass-shadow:
      inset 0 1px 0 oklch(100% 0 0 / calc(0.12 * var(--glass-strength))),
      0 0 20px oklch(55% 0.22 260 / calc(0.15 * var(--glow-strength)));

    /* ── Sea backdrop hex fallbacks (Three.js) ───────── */
    --sw-sea-bg-hex: #0a0f1a;
    --sw-sea-primary-hex: #2563eb;
    --sw-sea-lightning-hex: #60a5fa;
  }
}
```

- [ ] **Step 2: Verify the file parses correctly**

Run: `npx stylelint apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css --fix 2>&1 || echo "No stylelint — check file manually"`

If no stylelint, open the file and visually confirm no syntax errors (matching braces, semicolons).

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/shared/themes-tfc-silent-wake.css
git commit -m "feat(tfc): add silent-wake token theme

Dark navy/slate/blue color palette, rounded radius tokens,
blue glow/glass, disabled scanlines, sea backdrop hex fallbacks.
All scoped under [data-theme='tfc-silent-wake']."
```

---

### Task 2: Create Component Overrides File — Typography & Headers

**Files:**
- Create: `apps/tfc/frontend/src/app/shared/components-silent-wake.css`

- [ ] **Step 1: Create the component overrides file with typography and header sections**

This is the first part of the overrides file. We will append more sections in Task 3.

```css
/* ── Silent Wake — Component Overrides ────────────────────
 *  Visual overrides scoped to [data-theme="tfc-silent-wake"].
 *  Covers typography, rounding, scanline suppression, badges.
 *  Does NOT change layouts or logic — only presentation.
 * ──────────────────────────────────────────────────────── */

@layer components {

  /* ── Typography ──────────────────────────────────────── */

  [data-theme="tfc-silent-wake"] .home-hero__title {
    font-family: var(--font-sans, system-ui, sans-serif);
    font-weight: 900;
    letter-spacing: -0.025em;
    color: var(--color-foreground);
  }

  [data-theme="tfc-silent-wake"] .home-hero__title::before,
  [data-theme="tfc-silent-wake"] .home-hero__title::after {
    content: none;
  }

  [data-theme="tfc-silent-wake"] .home-hero__subtitle {
    font-family: var(--font-sans, system-ui, sans-serif);
    font-weight: 700;
    letter-spacing: 0.35em;
    color: var(--color-accent);
  }

  [data-theme="tfc-silent-wake"] .player-header__title {
    font-family: var(--font-sans, system-ui, sans-serif);
    font-weight: 900;
    letter-spacing: -0.025em;
    color: var(--color-foreground);
  }

  [data-theme="tfc-silent-wake"] .tac-panel__label {
    font-family: var(--font-sans, system-ui, sans-serif);
    font-weight: 700;
  }

  [data-theme="tfc-silent-wake"] .mode-heading {
    color: var(--color-accent);
    letter-spacing: 0.35em;
  }

  [data-theme="tfc-silent-wake"] .cmd-panel__title {
    font-family: var(--font-sans, system-ui, sans-serif);
    font-weight: 900;
    letter-spacing: -0.025em;
    color: var(--color-foreground);
  }

  /* ── Header — scanline suppression ───────────────────── */

  [data-theme="tfc-silent-wake"] .player-header {
    border-bottom-color: var(--color-border);
  }

  [data-theme="tfc-silent-wake"] .player-header::after,
  [data-theme="tfc-silent-wake"] .home-hero::after,
  [data-theme="tfc-silent-wake"] .cmd-panel__header::after {
    display: none;
  }

  [data-theme="tfc-silent-wake"] .cmd-panel__header {
    border-bottom-color: var(--color-border);
  }
```

**Do not close the `@layer components` block yet** — we continue in Task 3.

- [ ] **Step 2: Verify no syntax errors so far**

Open the file and confirm indentation and selector correctness. The `@layer components {` is intentionally left open.

- [ ] **Step 3: Commit work-in-progress**

```bash
git add apps/tfc/frontend/src/app/shared/components-silent-wake.css
git commit -m "feat(tfc): silent-wake component overrides — typography & headers

Sans-serif headlines, label typography, scanline suppression
for player header, home hero, and command panel."
```

---

### Task 3: Component Overrides — Cards, Panels & Waiting Room

**Files:**
- Modify: `apps/tfc/frontend/src/app/shared/components-silent-wake.css`

- [ ] **Step 1: Append card and panel overrides**

Add the following after the header section, still inside the `@layer components` block:

```css

  /* ── Cards & Panels — rounding + left-border removal ── */

  [data-theme="tfc-silent-wake"] .role-card {
    border-radius: var(--radius-lg);
  }

  [data-theme="tfc-silent-wake"] .role-card--intel {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  [data-theme="tfc-silent-wake"] .role-card--active {
    border-radius: var(--radius-lg);
  }

  [data-theme="tfc-silent-wake"] .role-card--done {
    border-radius: var(--radius-lg);
  }

  /* Tac-panel: rounding + re-color hardcoded hue 195→260 */
  [data-theme="tfc-silent-wake"] .tac-panel {
    border-radius: var(--radius-xl);
    border: 1px solid oklch(100% 0 0 / 6%);
    background: oklch(15% 0.02 250 / 60%);
  }

  [data-theme="tfc-silent-wake"] .tac-panel:hover {
    background: oklch(20% 0.02 260 / 65%);
    border-color: var(--color-primary);
    transform: translateX(4px);
    box-shadow: -4px 0 12px oklch(55% 0.22 260 / 20%);
  }

  [data-theme="tfc-silent-wake"] .tac-panel::after {
    background: linear-gradient(
      90deg,
      transparent 0%,
      oklch(55% 0.22 260 / 8%) 45%,
      oklch(55% 0.22 260 / 12%) 50%,
      oklch(55% 0.22 260 / 8%) 55%,
      transparent 100%
    );
  }

  [data-theme="tfc-silent-wake"] .tac-panel[data-primary] {
    border-color: oklch(55% 0.22 260 / 30%);
    background: oklch(15% 0.02 260 / 55%);
    box-shadow: 0 0 20px oklch(55% 0.22 260 / 12%);
  }

  /* Event & issue tiles */
  [data-theme="tfc-silent-wake"] .event-tile {
    border-radius: var(--radius-sm);
    border-left: 1px solid var(--color-border);
  }

  [data-theme="tfc-silent-wake"] .event-tile__icon {
    border-radius: var(--radius-sm);
  }

  [data-theme="tfc-silent-wake"] .issue-tile {
    border-radius: var(--radius-sm);
    border-left: 1px solid var(--color-border);
  }

  [data-theme="tfc-silent-wake"] .issue-tile[data-lifecycle="active"] {
    border-left: 1px solid var(--color-destructive);
  }

  [data-theme="tfc-silent-wake"] .issue-tile[data-lifecycle="mitigated"] {
    border-left: 1px solid var(--color-warning);
  }

  [data-theme="tfc-silent-wake"] .issue-tile[data-lifecycle="resolved"] {
    border-left: 1px solid var(--color-success);
  }

  [data-theme="tfc-silent-wake"] .issue-detail {
    border-radius: var(--radius-sm);
  }

  /* Dossier card (scenario picker) */
  [data-theme="tfc-silent-wake"] .dossier-card {
    border-radius: var(--radius-sm);
    border-left: 1px solid var(--color-border);
  }

  /* CO card (two-player mode) */
  [data-theme="tfc-silent-wake"] .co-card {
    border-radius: var(--radius-lg);
    border-left: 1px solid var(--color-border);
  }

  /* CO decision bar options */
  [data-theme="tfc-silent-wake"] .co-decision-bar__option {
    border-radius: var(--radius-sm);
  }

  /* Decision log entries */
  [data-theme="tfc-silent-wake"] .decision-entry {
    border-radius: var(--radius-sm);
    border-left: 1px solid var(--color-border);
  }

  [data-theme="tfc-silent-wake"] .decision-entry[data-status="closed"] {
    border-left-color: var(--color-success);
  }

  [data-theme="tfc-silent-wake"] .decision-entry[data-status="open"] {
    border-left-color: var(--color-warning);
  }

  /* System & warfare chips */
  [data-theme="tfc-silent-wake"] .system-chip {
    border-radius: var(--radius-sm);
  }

  [data-theme="tfc-silent-wake"] .warfare-chip {
    border-radius: var(--radius-sm);
  }

  /* ── Waiting Room ────────────────────────────────────── */

  [data-theme="tfc-silent-wake"] .crew-station {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  [data-theme="tfc-silent-wake"] .crew-station[data-filled] {
    border-color: var(--color-success);
  }

  [data-theme="tfc-silent-wake"] .crew-station[data-self] {
    border-color: var(--color-primary);
  }

  [data-theme="tfc-silent-wake"] .wr-sidebar__item {
    border-left: none;
    border-radius: var(--radius-sm);
  }

  [data-theme="tfc-silent-wake"] .wr-sidebar__item[data-active] {
    border-left: none;
    border: 1px solid var(--color-primary);
  }
```

- [ ] **Step 2: Verify selectors match the actual classes**

Cross-check the class names against the source files:
- `.co-card` → `components-two-player.css:116`
- `.co-decision-bar__option` → `components-two-player.css:41`
- `.crew-station` → `components-waiting-room.css:244`
- `.wr-sidebar__item` → `components-waiting-room.css:65`
- `.dossier-card` → `components-scenario-picker.css:18`
- `.decision-entry` → `components-logs.css:9`
- `.system-chip` → `components-systems.css:28`
- `.warfare-chip` → `components-systems.css:177`

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/shared/components-silent-wake.css
git commit -m "feat(tfc): silent-wake overrides — cards, panels, waiting room

Rounded cards/panels, left-border removal, tac-panel hue shift,
crew station and sidebar item styling for waiting room."
```

---

### Task 4: Component Overrides — Forms, Badges & Overlays

**Files:**
- Modify: `apps/tfc/frontend/src/app/shared/components-silent-wake.css`

- [ ] **Step 1: Append stress bar, phase badge, role badge, button, footer, and overlay overrides**

Add the following, then **close the `@layer components` block** (opened in Task 2). The file is not syntactically valid CSS until this closing brace is added — that's expected for the WIP commits in Tasks 2-3:

```css

  /* ── Stress Bar — pill shape ─────────────────────────── */

  [data-theme="tfc-silent-wake"] .stress-bar__track {
    border-radius: 9999px;
    background: var(--color-muted);
  }

  [data-theme="tfc-silent-wake"] .stress-bar__fill {
    border-radius: 9999px;
  }

  /* Keep severity colors (green/yellow/red) but make pill-shaped.
     The base [data-severity] selectors in components-systems.css
     handle the fill color — we only override the shape here. */

  /* ── Phase Badge — pill with status color ────────────── */
  /* Note: the actual class is .exercise-phase, not .phase-badge.
     See phase-badge.component.ts host: { class: "exercise-phase" }
     and components-exercise-layout.css line 124. */

  [data-theme="tfc-silent-wake"] .exercise-phase {
    border-radius: 9999px;
    padding: 0.15rem 0.75rem;
    font-weight: 600;
    background: color-mix(
      in oklch,
      var(--sw-phase-color, var(--color-muted-foreground)) 15%,
      transparent
    );
    border: 1px solid
      color-mix(
        in oklch,
        var(--sw-phase-color, var(--color-muted-foreground)) 50%,
        transparent
      );
    color: var(--sw-phase-color, var(--color-muted-foreground));
  }

  [data-theme="tfc-silent-wake"] [data-phase="running"] {
    --sw-phase-color: var(--color-success);
  }

  [data-theme="tfc-silent-wake"] [data-phase="briefing"] {
    --sw-phase-color: var(--color-primary);
  }

  [data-theme="tfc-silent-wake"] [data-phase="completed"] {
    --sw-phase-color: oklch(75% 0.12 80);
  }

  [data-theme="tfc-silent-wake"] [data-phase="setup"] {
    --sw-phase-color: var(--color-muted-foreground);
  }

  [data-theme="tfc-silent-wake"] [data-phase="paused"] {
    --sw-phase-color: var(--color-warning);
  }

  /* ── Role Badges — per-role color on playing-card badges ─ */
  /* data-role is on .playing-card__role-badge (child span).
     These style the badge text/bg directly. */

  [data-theme="tfc-silent-wake"] .playing-card__role-badge[data-role="co"],
  [data-theme="tfc-silent-wake"] .playing-card__role-badge[data-role="decision_maker"] {
    border: 1px solid oklch(75% 0.15 195 / 50%);
    background: oklch(70% 0.15 195 / 15%);
    color: oklch(90% 0.05 195);
  }

  [data-theme="tfc-silent-wake"] .playing-card__role-badge[data-role="admin"] {
    border: 1px solid oklch(80% 0.15 85 / 50%);
    background: oklch(75% 0.15 85 / 15%);
    color: oklch(92% 0.05 85);
  }

  /* Default advisor badge color (emerald) */
  [data-theme="tfc-silent-wake"] .playing-card__role-badge {
    border: 1px solid oklch(72% 0.17 160 / 50%);
    background: oklch(65% 0.17 160 / 15%);
    color: oklch(90% 0.05 160);
    border-radius: 9999px;
  }

  /* ── Buttons — font weight ───────────────────────────── */

  [data-theme="tfc-silent-wake"] button[class*="primary"],
  [data-theme="tfc-silent-wake"] [uiButton] {
    font-weight: 700;
  }

  /* ── Footer ──────────────────────────────────────────── */

  [data-theme="tfc-silent-wake"] .player-footer {
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  }

  /* ── Briefing & Completion Overlays ──────────────────── */
  /* Actual classes: .briefing-overlay__panel and
     .completion-overlay__panel (components-exercise-layout.css) */

  [data-theme="tfc-silent-wake"] .briefing-overlay__panel,
  [data-theme="tfc-silent-wake"] .completion-overlay__panel {
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
  }
}
```

Note: the closing `}` ends the `@layer components` block opened in Task 2.

- [ ] **Step 2: Verify the file is syntactically complete**

Count opening and closing braces to confirm the `@layer components` block is properly closed. Run:

```bash
grep -c '{' apps/tfc/frontend/src/app/shared/components-silent-wake.css
grep -c '}' apps/tfc/frontend/src/app/shared/components-silent-wake.css
```

The counts should match.

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/shared/components-silent-wake.css
git commit -m "feat(tfc): silent-wake overrides — badges, stress bar, overlays

Pill stress bar, phase badge with status colors, per-role color tokens,
footer rounding, briefing/completion overlay rounding."
```

---

### Task 5: Wire Imports in styles.css

**Files:**
- Modify: `apps/tfc/frontend/src/styles.css` (after line 16)

- [ ] **Step 1: Add the two new imports at the end of styles.css**

Append after the last existing import (`components-systems.css` on line 16):

```css
@import "./app/shared/themes-tfc-silent-wake.css";
@import "./app/shared/components-silent-wake.css";
```

The token file must come before the component file. Both must be after all existing imports.

- [ ] **Step 2: Verify the import order**

Read `styles.css` and confirm:
1. `themes-tfc-silent-wake.css` is imported after `components-systems.css`
2. `components-silent-wake.css` is imported last

- [ ] **Step 3: Smoke test — build the frontend**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | tail -20`

Expected: Build succeeds with no CSS errors. Warnings about unused tokens are acceptable.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/styles.css
git commit -m "feat(tfc): wire silent-wake theme imports in styles.css

Token theme and component overrides imported at end of stylesheet
chain for correct cascade priority."
```

---

### Task 6: Fix Sea Backdrop oklch Parsing

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/home/sea-backdrop.ts` (lines 80-87)

- [ ] **Step 1: Replace the `themeColor` getter**

The current getter at lines 80-87 always falls back to teal (`0x1ac5c5`) because all themes use oklch values. Replace it with a method that reads hex fallback tokens:

Find the existing code:
```typescript
private get themeColor(): THREE.Color {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-primary")
    .trim();
  return new THREE.Color(
    raw.startsWith("oklch") ? 0x1ac5c5 : raw || 0x1ac5c5,
  );
}
```

Replace with:
```typescript
private get themeColor(): THREE.Color {
  const style = getComputedStyle(document.documentElement);
  const hex = style.getPropertyValue("--sw-sea-primary-hex").trim();
  if (hex && hex.startsWith("#")) {
    return new THREE.Color(hex);
  }
  const raw = style.getPropertyValue("--color-primary").trim();
  if (raw && !raw.startsWith("oklch")) {
    return new THREE.Color(raw);
  }
  return new THREE.Color(0x1ac5c5);
}
```

- [ ] **Step 2: Update the background color initialization**

Find the line where the background color is set (around line 121):
```typescript
const bgColor = new THREE.Color(0x061218);
```

Replace with:
```typescript
const style = getComputedStyle(document.documentElement);
const bgHex = style.getPropertyValue("--sw-sea-bg-hex").trim();
const bgColor = new THREE.Color(
  bgHex && bgHex.startsWith("#") ? bgHex : 0x061218,
);
```

- [ ] **Step 3: Update lightning color in sea-lightning.ts**

The lightning flash color is hardcoded in `apps/tfc/frontend/src/app/features/home/sea-lightning.ts` at line 16. Find:
```typescript
private static readonly FLASH_COLOR = 0xe84057;
```

The lightning component needs to read the hex fallback token. Find the method or constructor where the bolt material/color is initialized and add a hex fallback read similar to the sea-backdrop fix. If the color is a static readonly, convert the initialization to read from CSS:

In the method that creates bolt geometry/material (look for where `FLASH_COLOR` is used), add:
```typescript
const style = getComputedStyle(document.documentElement);
const lightningHex = style.getPropertyValue("--sw-sea-lightning-hex").trim();
const flashColor = lightningHex && lightningHex.startsWith("#")
  ? new THREE.Color(lightningHex)
  : new THREE.Color(SeaLightning.FLASH_COLOR);
```

Use `flashColor` where the bolt material color is set.

- [ ] **Step 4: Verify the build still compiles**

Run: `cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | tail -20`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/features/home/sea-backdrop.ts apps/tfc/frontend/src/app/features/home/sea-lightning.ts
git commit -m "fix(tfc): sea backdrop and lightning read theme hex tokens

Fixes oklch parsing bug where all themes fell back to teal.
Now reads --sw-sea-primary-hex, --sw-sea-bg-hex, and
--sw-sea-lightning-hex when available. Falls back to existing
defaults for non-silent-wake themes."
```

---

### Task 7: Visual Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Activate the theme**

To test, temporarily set the theme on the HTML element. Find where `data-theme` is set in the app (likely in `app.ts` or a theme service) and confirm how to switch themes. If there is a theme selector UI, use it. Otherwise, use browser DevTools:

```
document.documentElement.setAttribute('data-theme', 'tfc-silent-wake')
```

- [ ] **Step 2: Verify home screen**

Check:
- Navy background, blue glow on panels
- Hero title: sans-serif, bold, no brackets
- Tac-panels: rounded (1.5rem), no left-accent borders
- Shimmer on hover uses blue (not teal)
- Sea backdrop tinted navy/blue (not green/teal)

- [ ] **Step 3: Verify waiting room**

Check:
- Rounded sidebar and main panels
- Crew stations: rounded, no left borders, colored border for filled/self
- Command panel header: no scanlines

- [ ] **Step 4: Verify player view**

Check:
- Header: no scanlines, border-bottom is slate-800 (not primary color), pill phase badge
- Stress bar: pill-shaped with blue gradient
- Role cards: rounded (1rem), no left-accent borders
- Decision options: rounded
- System/warfare chips: rounded

- [ ] **Step 5: Verify other themes are unaffected**

Switch to `tfc-cyber`:
```
document.documentElement.setAttribute('data-theme', 'tfc-cyber')
```

Check:
- Green color palette is intact
- Scanlines visible on headers
- Sharp 2px border-radius on cards
- Left-accent borders present

- [ ] **Step 6: Final commit (if any visual fixes were needed)**

If any adjustments were made during verification, commit them:

```bash
git add -u
git commit -m "fix(tfc): silent-wake visual polish from verification pass"
```
