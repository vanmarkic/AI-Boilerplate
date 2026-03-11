# Horizontal Histogram Timeline — Design

**Goal:** Add a dense horizontal histogram timeline component that displays event counts per time bucket (up to 720 bars) using pure CSS rendering.

**Visual:** Time axis left-to-right, vertical bars rising upward. Bars touch edge-to-edge (no gap) creating a density-plot aesthetic. Sparse time labels at configurable boundaries.

```
                    |
          |  ||    ||  |       |        ||
     |||||||||||||||||||| ||||||| ||||||||||
  |||||||||||||||||||||||||||||||||||||||||||||
  ─────────────────────────────────────────────
  8:00    9:00    10:00   11:00   12:00   13:00
```

**Tech:** Pure CSS (`@layer components`, CSS Grid, custom properties). No JS charting library. Framework-agnostic — CSS in `packages/design-system/components.css`, Angular wrapper in `frontend/`.

---

## HTML Contract

```html
<div class="histogram-timeline" role="img" aria-label="Events per minute, 8:00–19:59">
  <div class="histogram-bar" style="--bar-value: 0.2"
       data-label="8:00" data-label-visible data-count="3"></div>
  <div class="histogram-bar" style="--bar-value: 0.4"
       data-count="6"></div>
  <!-- ...bars without labels... -->
  <div class="histogram-bar" style="--bar-value: 0.6"
       data-label="9:00" data-label-visible data-count="9"></div>
  <!-- ... -->
</div>
```

### Data attributes

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `--bar-value` | Yes | 0–1 ratio (value / max). CSS renders as percentage height. |
| `data-count` | Yes | Raw count displayed in hover tooltip. |
| `data-label` | No | Time label text (e.g., "8:00"). |
| `data-label-visible` | No | Boolean. When present, renders tick + label below axis. |

**Consumer responsibility:** Normalize values to 0–1 ratio and decide which bars get visible labels.

---

## CSS Design

### Layout

- `.histogram-timeline` — CSS Grid container.
  - `grid-template-columns: repeat(auto-fit, minmax(0, 1fr))` — equal-width columns.
  - `grid-template-rows: 1fr auto` — bar area + label area.
  - `align-items: end` — bars grow upward from baseline.
  - Fixed height via `--histogram-height` custom property (default: `8rem`).
  - `gap: 0` — bars touch (dense histogram look).

- `.histogram-bar` — Grid item spanning row 1.
  - `height: calc(var(--bar-value) * 100%)` — proportional to value.
  - `min-height: 1px` — zero-value bars still show a hairline.
  - Background: `var(--color-primary)`.
  - Hover: `color-mix()` brightened.

### Hover tooltip

- `.histogram-bar::before` — invisible padding layer for hover target.
  - `content: ""`, `position: absolute`, `inset: 0`, extends horizontally with `padding-inline: 2px`.
  - Widens the effective hover zone from ~1px to ~5px.

- `.histogram-bar::after` — tooltip.
  - `content: attr(data-count)` — shows raw count.
  - `position: absolute`, `bottom: 100%`, `left: 50%`, `transform: translateX(-50%)`.
  - Styled as a small pill: `--color-popover` background, `--radius-sm`, `--font-size-xs`.
  - `opacity: 0` → `opacity: 1` on `:hover` with `transition`.

### Sparse labels

- `.histogram-bar[data-label-visible]::after` (in label row context) — this conflicts with tooltip.

**Revised approach:** Use a separate sub-grid row for labels. Bars with `data-label-visible` get a tick mark + label below the axis line via the `data-label` content. Bars without it leave the label row empty.

Actually, simpler: the tooltip uses `::after` on hover. The label uses a `::before` positioned below. But both pseudo-elements are taken.

**Final approach:** Two-part structure.

```html
<div class="histogram-timeline" role="img" aria-label="...">
  <div class="histogram-bars">
    <div class="histogram-bar" style="--bar-value: 0.2" data-count="3"></div>
    <!-- ...720 bars... -->
  </div>
  <div class="histogram-labels">
    <span class="histogram-label" style="--label-position: 0">8:00</span>
    <span class="histogram-label" style="--label-position: 60">9:00</span>
    <span class="histogram-label" style="--label-position: 120">10:00</span>
    <!-- ...sparse labels... -->
  </div>
</div>
```

This separates bars from labels. Labels are positioned with `--label-position` (bar index) converted to `left: calc(var(--label-position) / var(--bar-count) * 100%)`.

The tooltip remains `::after` on `.histogram-bar`.
The `::before` on `.histogram-bar` is the hover-zone widener.

### Variant support

| Variant | Use case |
|---------|----------|
| `default` | Primary color bars (`--color-primary`) |
| `success` | Green bars for positive metrics |
| `destructive` | Red bars for error/alert data |
| `muted` | Subdued bars for background context |

Applied via `data-variant` on `.histogram-timeline` (colors all bars).

### Responsive behavior

- Component is `width: 100%` — fills parent container.
- At narrow widths, sub-pixel bars naturally anti-alias into a smooth density plot.
- `--histogram-height` can be overridden by the consumer for different contexts.

---

## Angular Component

```typescript
@Component({
  selector: 'app-histogram-timeline',
  host: {
    'class': 'histogram-timeline',
    '[attr.data-variant]': 'variant()',
    '[attr.aria-label]': 'ariaLabel()',
    'role': 'img',
  },
  template: `
    <div class="histogram-bars">
      @for (bar of bars(); track $index) {
        <div class="histogram-bar"
             [style.--bar-value]="bar.value / max()"
             [attr.data-count]="bar.value">
        </div>
      }
    </div>
    <div class="histogram-labels">
      @for (label of labels(); track $index) {
        <span class="histogram-label"
              [style.--label-position]="label.index">
          {{ label.text }}
        </span>
      }
    </div>
  `,
})
export class HistogramTimelineComponent {
  readonly bars = input.required<HistogramBar[]>();
  readonly labels = input<HistogramLabel[]>([]);
  readonly ariaLabel = input<string>('');
  readonly variant = input<'default' | 'success' | 'destructive' | 'muted'>('default');

  protected readonly max = computed(() => {
    const values = this.bars().map(b => b.value);
    return Math.max(...values, 1);
  });
}

interface HistogramBar {
  value: number;
}

interface HistogramLabel {
  index: number;  // bar index where this label appears
  text: string;   // e.g., "8:00"
}
```

**Key:** The component computes `max()` and normalizes `bar.value / max()` to produce the 0–1 ratio. The consumer just passes raw counts.

---

## Files to create/modify

| File | Action |
|------|--------|
| `packages/design-system/components.css` | Add `.histogram-timeline`, `.histogram-bars`, `.histogram-bar`, `.histogram-labels`, `.histogram-label` |
| `frontend/src/app/shared/ui/histogram-timeline.component.ts` | Angular component |
| `frontend/src/app/shared/ui/histogram-timeline.component.spec.ts` | Vitest unit tests |
| `frontend/src/app/shared/ui/histogram-timeline.stories.ts` | Storybook stories |

---

## Acceptance criteria

1. Renders up to 720 bars with correct proportional heights
2. Hover on any bar shows count tooltip
3. Sparse time labels positioned at correct bar indices
4. Uses design tokens (colors, spacing, radius, fonts) — no hardcoded values
5. Supports `default`, `success`, `destructive`, `muted` variants
6. Accessible: `role="img"`, `aria-label` on container
7. Tests pass, lint passes, Storybook renders
