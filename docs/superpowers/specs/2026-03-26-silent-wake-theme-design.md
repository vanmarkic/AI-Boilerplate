# Silent Wake Theme — Design Spec

## Summary

Create a new `tfc-silent-wake` theme for the TFC frontend that matches the dark navy / slate / blue aesthetic from the reference React application. Implemented as a **token theme + component CSS overrides**, with a small TypeScript fix for the sea backdrop. All existing themes remain untouched.

## Decisions

| Question | Answer |
|----------|--------|
| Theme approach | New theme alongside existing (option C) |
| Screen scope | All screens (home, waiting room, player, GM, builder, review, foundation) |
| Sea backdrop | Keep Three.js — tint via hex fallback tokens + fix oklch parsing bug |
| Template changes | Minimal — sea backdrop TS fix only; no HTML template changes |

## Architecture

Two new CSS files, both scoped under `[data-theme="tfc-silent-wake"]`:

1. **`themes-tfc-silent-wake.css`** — `@layer tokens` block with color palette, glow, glass, radius, and scanline overrides.
2. **`components-silent-wake.css`** — `@layer components` block with deeper visual overrides for cards, buttons, inputs, headers, badges, and typography.

Both files are imported in `styles.css` **after all existing imports** to ensure cascade priority within the same layer.

One TypeScript file is modified:

3. **`sea-backdrop.ts`** — Fix the `themeColor` getter to parse oklch values (or read a hex fallback token) instead of always falling back to teal.

## Section 1: Token Layer (`themes-tfc-silent-wake.css`)

### Color Palette

All values use oklch. The "Approx" column shows the closest Tailwind shade for reference; values are tuned for the theme, not exact Tailwind matches.

**Surfaces:**

| Token | Value | Approx |
|-------|-------|--------|
| `--color-background` | `oklch(8% 0.02 250)` | ~ #0a0f1a (darker than slate-950) |
| `--color-card` | `oklch(15% 0.02 250)` | ~ slate-900 (dark card surface) |
| `--color-popover` | `oklch(19% 0.02 250)` | ~ slate-800 |
| `--color-secondary` | `oklch(30% 0.015 250)` | ~ slate-700 |
| `--color-muted` | `oklch(28% 0.015 250)` | ~ slate-800 |
| `--color-border` | `oklch(25% 0.015 250)` | ~ slate-800 |
| `--color-input` | `oklch(5% 0.02 250)` | ~ slate-950 (inset field, darker than bg) |

**Text:**

| Token | Value | Approx |
|-------|-------|--------|
| `--color-foreground` | `oklch(98% 0 0)` | white |
| `--color-card-foreground` | `oklch(98% 0 0)` | white |
| `--color-muted-foreground` | `oklch(60% 0.015 250)` | ~ slate-400/500 |

**Primary / Accent:**

| Token | Value | Approx |
|-------|-------|--------|
| `--color-primary` | `oklch(55% 0.22 260)` | ~ blue-600 |
| `--color-primary-foreground` | `oklch(98% 0 0)` | white |
| `--color-accent` | `oklch(78% 0.12 250)` | ~ blue-300 |
| `--color-accent-foreground` | `oklch(8% 0.02 250)` | dark bg |
| `--color-ring` | `oklch(55% 0.22 260)` | ~ blue-600 |

**Semantic colors:** Inherit from base system defaults (red destructive, yellow warning, green success). No override needed — the base values work well against the navy background.

### Glow & Glass

Must use `calc()` multiplier pattern (same as all other themes) to preserve `prefers-reduced-motion` and `prefers-contrast` accessibility overrides:

```css
--glow-strength: 1;
--glass-strength: 1;
--glow-color: oklch(55% 0.22 260);
--glow-sm: 0 0 14px oklch(55% 0.22 260 / calc(0.5 * var(--glow-strength)));
--glow-primary: 0 0 28px oklch(55% 0.22 260 / calc(0.75 * var(--glow-strength)));
--glow-lg: 0 0 48px oklch(55% 0.22 260 / calc(1 * var(--glow-strength)));
--glow-xl:
  0 0 72px oklch(55% 0.22 260 / calc(0.6 * var(--glow-strength))),
  0 0 120px oklch(55% 0.22 260 / calc(0.25 * var(--glow-strength)));
--glass-shadow:
  inset 0 1px 0 oklch(100% 0 0 / calc(0.12 * var(--glass-strength))),
  0 0 20px oklch(55% 0.22 260 / calc(0.15 * var(--glow-strength)));
```

### Radius

| Token | Value | Notes |
|-------|-------|-------|
| `--radius-sm` | `0.5rem` | Cards, inputs, buttons (was 2px) |
| `--radius-md` | `0.75rem` | Medium containers |
| `--radius-lg` | `1rem` | Role cards, panels |
| `--radius-xl` | `1.5rem` | Major containers, tac-panels (new token, scoped to this theme) |
| `--radius-full` | `9999px` | Pills, badges (unchanged) |

### Scanlines

```css
--overlay-scanline: transparent;
```

Suppresses the CRT scanline overlay on headers and hero sections. Other themes keep their scanlines.

### Sea Backdrop Hex Fallback

For Three.js which cannot read oklch:

```css
--sw-sea-bg-hex: #0a0f1a;
--sw-sea-primary-hex: #2563eb;
--sw-sea-lightning-hex: #60a5fa;
```

## Section 2: Component CSS Overrides (`components-silent-wake.css`)

All rules scoped under `[data-theme="tfc-silent-wake"]`.

### Typography

- `.home-hero__title`: Remove `::before`/`::after` bracket pseudo-elements (`content: none`). Switch from `font-family: var(--font-mono)` to `font-family: var(--font-sans)`. Use `font-weight: 900`, `letter-spacing: -0.025em`.
- `.home-hero__subtitle`: Use `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.35em`, `color: var(--color-accent)`.
- `.player-header__title`: Same treatment — sans-serif, black weight, tight tracking.
- `.tac-panel__label`: Switch from mono to sans-serif, increase weight to 700.
- `.mode-heading`: Use accent color, wider tracking (0.35em).

### Cards & Panels

- `.role-card`: `border-radius: var(--radius-lg)`. Remove `border-left` accent — use uniform `border: 1px solid var(--color-border)`.
- `.role-card--intel`: Remove `border-left: 3px solid var(--color-primary)`, use uniform border.
- `.role-card--active`: `border-color` uses `var(--color-success)` (same), but `border-radius: var(--radius-lg)`.
- `.tac-panel`: `border-radius: var(--radius-xl)`. Remove `border-left: 3px solid`. Use uniform border. Override hardcoded backgrounds (`oklch(18% 0.008 250 / 60%)` → `oklch(15% 0.02 250 / 60%)` with hue 250).
- `.tac-panel:hover`: Override hardcoded hover bg from hue 195 to hue 260.
- `.tac-panel[data-primary]`: Override hardcoded border/bg/shadow from hue 195 to hue 260.
- `.tac-panel::after` shimmer: Override gradient colors from hue 195 to hue 260.
- `.event-tile`, `.issue-tile`: `border-radius: var(--radius-sm)`. Remove left-accent borders — use uniform border with colored `box-shadow` for lifecycle indication instead.
- `.event-tile__icon`: `border-radius: var(--radius-sm)`.
- `.issue-detail`: `border-radius: var(--radius-sm)`.
- `.dossier-card`: `border-radius: var(--radius-sm)`. Remove `border-left: 3px solid`, use uniform border.
- `.co-card`: `border-radius: var(--radius-lg)`. Remove `border-left: 3px solid var(--color-accent)`, use uniform border.
- `.co-decision-bar__option`: `border-radius: var(--radius-sm)`.
- `.decision-entry`: `border-radius: var(--radius-sm)`. Remove `border-left: 3px solid`, use uniform border.
- `.system-chip`, `.warfare-chip`: `border-radius: var(--radius-sm)`.

### Header

- `.player-header`: `border-bottom: 1px solid var(--color-border)` instead of `var(--color-primary)`.
- `.player-header::after`: `display: none` (belt-and-suspenders with transparent scanline token).
- `.home-hero::after`: `display: none`.
- `.cmd-panel__header::after`: `display: none` (suppress waiting room command panel scanlines).

### Waiting Room

- `.crew-station`: Remove `border-left: 3px solid var(--color-muted)`. Use uniform border, `border-radius: var(--radius-md)`.
- `.wr-sidebar__item`: Remove `border-left: 3px solid transparent`. Use uniform border, `border-radius: var(--radius-sm)`.

### Buttons

- Primary buttons: `border-radius: var(--radius-sm)`, `font-weight: 700`.
- Secondary/outline: `border-radius: var(--radius-sm)`, transparent bg, `border: 1px solid var(--color-border)`.
- These are handled by the `@aspect/ui` button component picking up the token radius, plus an override for weight.

### Inputs

- `border-radius: var(--radius-sm)`, `background: var(--color-input)` (slate-950), `border: 1px solid var(--color-border)`.

### Stress Bar

- `.stress-bar__fill`: `border-radius: 9999px`.
- `.stress-bar__track`: `border-radius: 9999px`, `background: var(--color-muted)`.
- Fill gradient: `linear-gradient(90deg, var(--color-primary), oklch(60% 0.2 260))` (blue gradient).

### Phase Badge

- `border-radius: 9999px` (pill shape).
- Status-colored background using `color-mix()` with per-phase custom property.
- Phase values use the actual data attributes from the codebase: `setup`, `running` (not "playing"), `paused`, `briefing`, `completed`.
- Color mapping:

```css
[data-theme="tfc-silent-wake"] [data-phase="running"]  { --sw-phase-color: var(--color-success); }
[data-theme="tfc-silent-wake"] [data-phase="briefing"]  { --sw-phase-color: var(--color-primary); }
[data-theme="tfc-silent-wake"] [data-phase="completed"] { --sw-phase-color: oklch(75% 0.12 80); /* amber */ }
[data-theme="tfc-silent-wake"] [data-phase="setup"]     { --sw-phase-color: var(--color-muted-foreground); }
[data-theme="tfc-silent-wake"] [data-phase="paused"]    { --sw-phase-color: var(--color-warning); }
```

Then the badge uses:
```css
background: color-mix(in oklch, var(--sw-phase-color) 15%, transparent);
border: 1px solid color-mix(in oklch, var(--sw-phase-color) 50%, transparent);
color: var(--sw-phase-color);
```

### Role Badges

Per-role color system using `[data-role]` attribute selectors (matching existing role name strings in templates — no template changes needed):

| Selector | Border | Background | Text |
|----------|--------|------------|------|
| `[data-role="co"]` | `rgba(34,211,238,0.5)` | `rgba(6,182,212,0.15)` | cyan-100 |
| `[data-role="admin"]` | `rgba(251,191,36,0.5)` | `rgba(245,158,11,0.15)` | amber-100 |

For advisor roles (scenario-defined, variable names), use a generic fallback + specific overrides for common roles:

| Selector | Color family |
|----------|-------------|
| Default advisor (no specific match) | emerald |
| Known role overrides as needed | fuchsia, rose, violet, sky |

This avoids needing a `data-role-index` attribute. The emerald default works for most 2-player/3-player setups. For scenarios with 4+ advisors, all unmapped advisors share emerald — acceptable given the rarity.

### Footer

- `border-radius: var(--radius-sm) var(--radius-sm) 0 0` (slight top rounding).
- Same layout and content.

### Briefing & Completion Overlays

- Modal card: `border-radius: var(--radius-xl)`, `border: 1px solid var(--color-border)`.
- Backdrop: same dark overlay.
- Title: label→headline pattern.
- Action button: blue-600 primary style.

### Glitch Animation

The `.tac-panel:hover .tac-panel__label` glitch animation is **kept** — it works with any color scheme since it uses `var(--color-primary)`.

## Section 3: Per-Screen Notes

### Home

- Sea backdrop tinted navy/blue via hex fallback tokens.
- Hero: label→headline (no brackets, sans-serif).
- Tac-panels: rounded, no left borders, shimmer re-colored to hue 260.
- Mode selector: rounded option cards.

### Waiting Room

- Sidebar + main: both rounded panels.
- Role slots: per-role color coding. Empty slots use dashed borders.
- Crew stations and sidebar items: left-border removed, rounded.
- Command panel header: scanlines suppressed.
- Deploy button: blue-600 primary when ready, muted when disabled.

### Player View

- Header: no scanlines, glass bg, label→headline title, pill stress bar, pill phase badge.
- Board columns: same auto-fit grid, rounded role cards.
- CO decision bar: rounded option cards, blue accent for selected.
- Turn banner: same layout, rounded container.

### Game Master

- Same 4-row grid layout.
- Rounded panels for item actions and timeline.
- Timeline bars: rounded caps, blue accent.
- Header: label→headline, pill phase badge.

### Scenario Builder / Review / Foundation

- Token layer handles colors, typography, and radius automatically.
- Component overrides add rounding to form elements, result cards, admin panels, dossier cards.
- Same layouts throughout.

### Sea Backdrop

The Three.js backdrop component currently hard-codes colors and has an oklch parsing bug in the `themeColor` getter (falls back to teal `0x1ac5c5` whenever it encounters an oklch value, which is always).

**Fix:** Modify `sea-backdrop.ts` to read hex fallback tokens:
- Background: `--sw-sea-bg-hex` (fallback: current hard-coded `#061218`)
- Water/primary: `--sw-sea-primary-hex` (fallback: current `#1ac5c5`)
- Lightning: `--sw-sea-lightning-hex` (fallback: current lightning color)

The component reads these via `getComputedStyle()` on init and on theme change. Non-silent-wake themes continue to work via fallback values. This also fixes the pre-existing oklch parsing bug for all themes.

## Files Changed

| File | Action | Layer |
|------|--------|-------|
| `shared/themes-tfc-silent-wake.css` | Create | `@layer tokens` |
| `shared/components-silent-wake.css` | Create | `@layer components` |
| `src/styles.css` | Edit — add 2 imports **at the end** | Global |
| `features/home/sea-backdrop.ts` | Edit — fix oklch bug, read hex fallback tokens | Component TS |

No HTML template files are modified. No existing CSS files are modified.

## Testing

- Activate theme via `data-theme="tfc-silent-wake"` on `<html>` element.
- Verify each screen visually: home, waiting room, player (all modes), GM, builder, review, foundation.
- Verify sea backdrop tints correctly (navy water, blue lightning).
- Verify other themes still render correctly (no cross-contamination from scoped rules).
- Verify stress overlay, animations, and GSAP effects still work.
- Verify `prefers-reduced-motion` suppresses glow correctly (test `--glow-strength: 0` propagation).
- Verify phase badge colors for all phase states: setup, briefing, running, paused, completed.
