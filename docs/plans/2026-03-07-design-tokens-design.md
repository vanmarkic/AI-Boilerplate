# Design Tokens & Visual Theme — Dark Military Utilitarian

## Visual Identity

**Mood:** Dark, military, utilitarian. Command terminals, tactical HUDs, stamped metal.
**Accent:** Steel blue — muted, authoritative, NATO-map feel.
**Semantic signals:** Red (error), amber (warning), green (success), light blue (info).
**Typography:** Inter — mechanical, screen-optimized, tight.
**Corners:** Near-zero radii. Sharp, stamped-metal feel.
**Motion:** Minimal, snappy. No bounces, no elastic easing.

---

## 1. Color Palette (OKLch)

### Base surfaces (dark → light)
| Token              | Value                     | Usage                        |
|--------------------|---------------------------|------------------------------|
| `background`       | `oklch(13% 0.008 250)`   | App background, blacked-out  |
| `card`             | `oklch(18% 0.008 250)`   | Elevated surface (cards)     |
| `popover`          | `oklch(22% 0.008 250)`   | Dropdowns, popovers, modals  |
| `secondary`        | `oklch(22% 0.008 250)`   | Secondary fills              |
| `muted`            | `oklch(25% 0.008 250)`   | Disabled fills, subtle bg    |

### Borders & inputs
| Token              | Value                     | Usage                        |
|--------------------|---------------------------|------------------------------|
| `border`           | `oklch(30% 0.010 250)`   | Default borders              |
| `input`            | `oklch(30% 0.010 250)`   | Input field borders          |

### Text
| Token              | Value                     | Usage                        |
|--------------------|---------------------------|------------------------------|
| `foreground`       | `oklch(92% 0 0)`         | Primary text (off-white)     |
| `card-foreground`  | `oklch(92% 0 0)`         | Text on cards                |
| `popover-fg`       | `oklch(92% 0 0)`         | Text on popovers             |
| `secondary-fg`     | `oklch(85% 0 0)`         | Secondary text               |
| `muted-foreground` | `oklch(55% 0.005 250)`   | Disabled/placeholder text    |

### Accent (steel blue)
| Token              | Value                     | Usage                        |
|--------------------|---------------------------|------------------------------|
| `primary`          | `oklch(62% 0.10 245)`    | Primary actions, links       |
| `primary-foreground`| `oklch(13% 0.008 250)`  | Text on primary buttons      |
| `accent`           | `oklch(62% 0.10 245)`    | Hover highlights             |
| `accent-foreground`| `oklch(92% 0 0)`         | Text on accent bg            |
| `ring`             | `oklch(62% 0.10 245)`    | Focus rings                  |

### Semantic signals
| Token              | Value                     | Usage                        |
|--------------------|---------------------------|------------------------------|
| `destructive`      | `oklch(55% 0.22 27)`     | Error/danger actions         |
| `destructive-fg`   | `oklch(92% 0 0)`         | Text on destructive          |
| `warning`          | `oklch(72% 0.17 70)`     | Warning states               |
| `warning-foreground`| `oklch(13% 0.008 250)`  | Text on warning              |
| `success`          | `oklch(62% 0.15 155)`    | Success states               |
| `success-foreground`| `oklch(13% 0.008 250)`  | Text on success              |
| `info`             | `oklch(70% 0.08 245)`    | Informational states         |
| `info-foreground`  | `oklch(13% 0.008 250)`   | Text on info                 |

---

## 2. Typography

**Font stack:** `"Inter", system-ui, sans-serif`
**Mono stack:** `"JetBrains Mono", ui-monospace, monospace` (for code, data labels, IDs)

### Type scale (modular, minor third 1.2×)
| Token       | Size     | Line Height | Usage                      |
|-------------|----------|-------------|----------------------------|
| `text-xs`   | 0.75rem  | 1rem        | Captions, meta             |
| `text-sm`   | 0.875rem | 1.25rem     | Body small, labels         |
| `text-base` | 1rem     | 1.5rem      | Body default               |
| `text-lg`   | 1.125rem | 1.75rem     | Card titles, subheads      |
| `text-xl`   | 1.25rem  | 1.75rem     | Section headings           |
| `text-2xl`  | 1.5rem   | 2rem        | Page titles                |
| `text-3xl`  | 1.875rem | 2.25rem     | Hero headings (rare)       |

### Font weights
| Token            | Weight | Usage                          |
|------------------|--------|--------------------------------|
| `font-normal`    | 400    | Body text                      |
| `font-medium`    | 500    | Labels, buttons                |
| `font-semibold`  | 600    | Headings, emphasis             |
| `font-bold`      | 700    | Hero headings only             |

### Tracking (letter spacing)
| Token             | Value     | Usage                        |
|-------------------|-----------|------------------------------|
| `tracking-tight`  | -0.01em   | Headings                     |
| `tracking-normal` | 0         | Body                         |
| `tracking-wide`   | 0.05em    | All-caps labels, badges      |

---

## 3. Spacing

Tightened 4px base grid. Military UIs are dense.

| Token   | Value    | px  | Usage                            |
|---------|----------|-----|----------------------------------|
| `xs`    | 0.25rem  | 4   | Inline gaps, icon padding        |
| `sm`    | 0.5rem   | 8   | Tight element gaps               |
| `md`    | 1rem     | 16  | Standard padding, card gutter    |
| `lg`    | 1.5rem   | 24  | Section padding                  |
| `xl`    | 2rem     | 32  | Page-level spacing               |
| `2xl`   | 3rem     | 48  | Major section breaks             |

---

## 4. Border Radius

Near-zero. Stamped metal, tactical.

| Token        | Value  | Usage                              |
|--------------|--------|------------------------------------|
| `radius-sm`  | 2px    | Badges, small elements             |
| `radius-md`  | 4px    | Buttons, inputs, cards             |
| `radius-lg`  | 6px    | Dialogs, panels                    |
| `radius-full`| 9999px | Avatars, status dots               |

---

## 5. Shadows

Minimal. Dark UIs need subtler shadows — rely on border contrast instead.

| Token        | Value                                           | Usage               |
|--------------|-------------------------------------------------|----------------------|
| `shadow-sm`  | `0 1px 2px oklch(0% 0 0 / 0.3)`               | Cards, inputs        |
| `shadow-md`  | `0 2px 6px oklch(0% 0 0 / 0.4)`               | Dropdowns            |
| `shadow-lg`  | `0 4px 12px oklch(0% 0 0 / 0.5)`              | Modals, dialogs      |

---

## 6. Motion

Snappy and functional. No decorative animation.

| Token                | Value                  | Usage                     |
|----------------------|------------------------|---------------------------|
| `duration-fast`      | 100ms                  | Hover, focus              |
| `duration-normal`    | 150ms                  | Transitions               |
| `duration-slow`      | 250ms                  | Panel open/close          |
| `ease-default`       | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Standard easing |

---

## 7. Z-Index Scale

| Token     | Value | Usage                              |
|-----------|-------|------------------------------------|
| `z-base`  | 0     | Default                            |
| `z-above` | 10    | Sticky headers, floating elements  |
| `z-modal` | 50    | Modals, dialogs, overlays          |
| `z-toast` | 100   | Toast notifications                |

---

## 8. Component Impact

Components that need updating after token change:
- **ButtonComponent** — `rounded-md` → `rounded-[--radius-md]`, accent color shift
- **CardComponent** — `rounded-lg` → `rounded-[--radius-lg]`, shadow adjustment
- **BadgeComponent** — `rounded-md` → `rounded-[--radius-sm]`, tracking-wide for text
- **InputComponent** — `rounded-md` → `rounded-[--radius-md]`, border refinement
- **DialogPanelComponent** — `rounded-lg` → `rounded-[--radius-lg]`, shadow adjustment
- **FormErrorComponent** — No structural change (just color token shift)
