# Histogram Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dense horizontal histogram timeline component (up to 720 bars) to the design system and Angular frontend.

**Architecture:** Framework-agnostic CSS in `packages/design-system/components.css` using CSS Grid + custom properties. Thin Angular component wrapper computes max value, normalizes bars to 0–1 ratios, and renders the template. Bars touch edge-to-edge. Sparse labels positioned via percentage offsets. Hover tooltip via `::after` pseudo-element.

**Tech Stack:** Pure CSS (`@layer components`, CSS Grid, native nesting, `color-mix()`), Angular 21 (signals, standalone components, zoneless CD), Vitest + Angular TestBed, Storybook 10.

---

## Task 1: Add histogram CSS to design system

**Files:**
- Modify: `packages/design-system/components.css` (append after `.dialog-footer` block, before closing `}` of `@layer components`)

**Step 1: Add the CSS**

Append the following inside `@layer components { ... }` in `packages/design-system/components.css`, after the Dialog section:

```css
  /* ── Histogram Timeline ──────────────────────────────── */

  .histogram-timeline {
    --histogram-height: 8rem;
    --histogram-bar-color: var(--color-primary);

    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .histogram-timeline[data-variant="success"] {
    --histogram-bar-color: var(--color-success);
  }

  .histogram-timeline[data-variant="destructive"] {
    --histogram-bar-color: var(--color-destructive);
  }

  .histogram-timeline[data-variant="muted"] {
    --histogram-bar-color: var(--color-muted-foreground);
  }

  .histogram-bars {
    display: flex;
    align-items: flex-end;
    height: var(--histogram-height);
    gap: 0;
  }

  .histogram-bar {
    flex: 1 1 0%;
    height: calc(var(--bar-value) * 100%);
    min-height: 1px;
    background-color: var(--histogram-bar-color);
    position: relative;
    transition: background-color var(--duration-fast) var(--ease-default);

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      padding-inline: 2px;
      margin-inline: -2px;
    }

    &::after {
      content: attr(data-count);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      padding-inline: var(--spacing-xs);
      padding-block: 2px;
      border-radius: var(--radius-sm);
      background-color: var(--color-popover);
      color: var(--color-popover-foreground);
      font-size: var(--font-size-xs);
      line-height: var(--font-size-xs--line-height);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity var(--duration-fast) var(--ease-default);
      z-index: var(--z-above);
    }

    &:hover {
      background-color: color-mix(in oklch, var(--histogram-bar-color) 80%, white);

      &::after {
        opacity: 1;
      }
    }
  }

  .histogram-labels {
    position: relative;
    height: var(--font-size-xs--line-height);
  }

  .histogram-label {
    position: absolute;
    top: 0;
    left: calc(var(--label-position) / var(--bar-count) * 100%);
    font-size: var(--font-size-xs);
    line-height: var(--font-size-xs--line-height);
    color: var(--color-muted-foreground);
    transform: translateX(-50%);
    white-space: nowrap;
  }
```

**Step 2: Verify lint passes on the package**

Run: `cd packages/design-system && npx stylelint "*.css"`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add packages/design-system/components.css
git commit -m "feat(design-system): add histogram-timeline component styles"
```

---

## Task 2: Create the Angular component with tests (TDD)

**Files:**
- Create: `frontend/src/app/shared/ui/histogram-timeline.component.ts`
- Create: `frontend/src/app/shared/ui/histogram-timeline.component.spec.ts`

**Step 1: Write the failing tests**

Create `frontend/src/app/shared/ui/histogram-timeline.component.spec.ts`:

```typescript
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HistogramTimelineComponent,
  type HistogramBar,
  type HistogramLabel,
  type HistogramVariant,
} from './histogram-timeline.component';

@Component({
  imports: [HistogramTimelineComponent],
  template: `
    <app-histogram-timeline
      [bars]="bars()"
      [labels]="labels()"
      [ariaLabel]="ariaLabel()"
      [variant]="variant()"
    />
  `,
})
class TestHost {
  bars = signal<HistogramBar[]>([{ value: 5 }, { value: 10 }, { value: 3 }]);
  labels = signal<HistogramLabel[]>([{ index: 0, text: '8:00' }, { index: 2, text: '10:00' }]);
  ariaLabel = signal('Test histogram');
  variant = signal<HistogramVariant>('default');
}

describe('HistogramTimelineComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('app-histogram-timeline');
  });

  it('should have histogram-timeline class on host', () => {
    expect(host.classList.contains('histogram-timeline')).toBe(true);
  });

  it('should set role="img" on host', () => {
    expect(host.getAttribute('role')).toBe('img');
  });

  it('should set aria-label on host', () => {
    expect(host.getAttribute('aria-label')).toBe('Test histogram');
  });

  it('should render correct number of bars', () => {
    const bars = host.querySelectorAll('.histogram-bar');
    expect(bars.length).toBe(3);
  });

  it('should normalize bar heights to 0–1 ratio based on max value', () => {
    const bars = host.querySelectorAll('.histogram-bar');
    expect(getComputedBarValue(bars[0])).toBe('0.5');
    expect(getComputedBarValue(bars[1])).toBe('1');
    expect(getComputedBarValue(bars[2])).toBe('0.3');
  });

  it('should set data-count on each bar', () => {
    const bars = host.querySelectorAll('.histogram-bar');
    expect(bars[0].getAttribute('data-count')).toBe('5');
    expect(bars[1].getAttribute('data-count')).toBe('10');
    expect(bars[2].getAttribute('data-count')).toBe('3');
  });

  it('should render labels at correct positions', () => {
    const labels = host.querySelectorAll('.histogram-label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent?.trim()).toBe('8:00');
    expect(labels[1].textContent?.trim()).toBe('10:00');
  });

  it('should set --label-position and --bar-count on labels', () => {
    const labels = host.querySelectorAll('.histogram-label') as NodeListOf<HTMLElement>;
    expect(labels[0].style.getPropertyValue('--label-position')).toBe('0');
    expect(labels[1].style.getPropertyValue('--label-position')).toBe('2');
  });

  it('should set --bar-count on the labels container', () => {
    const labelsContainer = host.querySelector('.histogram-labels') as HTMLElement;
    expect(labelsContainer.style.getPropertyValue('--bar-count')).toBe('3');
  });

  it('should set data-variant="default" by default', () => {
    expect(host.getAttribute('data-variant')).toBe('default');
  });

  it('should set data-variant="destructive"', () => {
    fixture.componentInstance.variant.set('destructive');
    fixture.detectChanges();
    expect(host.getAttribute('data-variant')).toBe('destructive');
  });

  it('should handle empty bars array', () => {
    fixture.componentInstance.bars.set([]);
    fixture.detectChanges();
    const bars = host.querySelectorAll('.histogram-bar');
    expect(bars.length).toBe(0);
  });

  it('should handle all-zero values without division by zero', () => {
    fixture.componentInstance.bars.set([{ value: 0 }, { value: 0 }]);
    fixture.detectChanges();
    const bars = host.querySelectorAll('.histogram-bar');
    expect(getComputedBarValue(bars[0])).toBe('0');
    expect(getComputedBarValue(bars[1])).toBe('0');
  });
});

function getComputedBarValue(el: Element): string {
  return (el as HTMLElement).style.getPropertyValue('--bar-value');
}
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/app/shared/ui/histogram-timeline.component.spec.ts`
Expected: FAIL — module not found.

**Step 3: Write the component**

Create `frontend/src/app/shared/ui/histogram-timeline.component.ts`:

```typescript
import { Component, computed, input } from '@angular/core';

export interface HistogramBar {
  value: number;
}

export interface HistogramLabel {
  index: number;
  text: string;
}

export type HistogramVariant = 'default' | 'success' | 'destructive' | 'muted';

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
      @for (bar of normalizedBars(); track $index) {
        <div
          class="histogram-bar"
          [style.--bar-value]="bar.ratio"
          [attr.data-count]="bar.value"
        ></div>
      }
    </div>
    @if (labels().length > 0) {
      <div class="histogram-labels" [style.--bar-count]="bars().length">
        @for (label of labels(); track $index) {
          <span
            class="histogram-label"
            [style.--label-position]="label.index"
          >{{ label.text }}</span>
        }
      </div>
    }
  `,
})
export class HistogramTimelineComponent {
  readonly bars = input.required<HistogramBar[]>();
  readonly labels = input<HistogramLabel[]>([]);
  readonly ariaLabel = input<string>('');
  readonly variant = input<HistogramVariant>('default');

  protected readonly max = computed(() => {
    const values = this.bars().map(b => b.value);
    return Math.max(...values, 1);
  });

  protected readonly normalizedBars = computed(() =>
    this.bars().map(bar => ({
      value: bar.value,
      ratio: bar.value / this.max(),
    })),
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/shared/ui/histogram-timeline.component.spec.ts`
Expected: All 12 tests PASS.

**Step 5: Run full test suite**

Run: `cd frontend && npm run test:ci`
Expected: All tests pass (previous + 12 new).

**Step 6: Commit**

```bash
git add frontend/src/app/shared/ui/histogram-timeline.component.ts frontend/src/app/shared/ui/histogram-timeline.component.spec.ts
git commit -m "feat(histogram-timeline): add component with tests"
```

---

## Task 3: Add Storybook stories

**Files:**
- Create: `frontend/src/app/shared/ui/histogram-timeline.stories.ts`

**Step 1: Create the stories file**

Create `frontend/src/app/shared/ui/histogram-timeline.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { HistogramTimelineComponent } from './histogram-timeline.component';

function generateBars(count: number, maxValue: number) {
  return Array.from({ length: count }, () => ({
    value: Math.floor(Math.random() * maxValue),
  }));
}

function generateLabels(barCount: number, interval: number, formatter: (i: number) => string) {
  const labels = [];
  for (let i = 0; i < barCount; i += interval) {
    labels.push({ index: i, text: formatter(i) });
  }
  return labels;
}

const meta: Meta<HistogramTimelineComponent> = {
  title: 'UI/HistogramTimeline',
  component: HistogramTimelineComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'success', 'destructive', 'muted'] },
  },
};
export default meta;

type Story = StoryObj<HistogramTimelineComponent>;

export const Default: Story = {
  args: {
    bars: generateBars(60, 20),
    labels: generateLabels(60, 10, i => `${i}m`),
    ariaLabel: 'Events per minute (1 hour)',
    variant: 'default',
  },
};

export const Dense720Bars: Story = {
  args: {
    bars: generateBars(720, 50),
    labels: generateLabels(720, 60, i => `${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}`),
    ariaLabel: 'Events per minute (12 hours)',
    variant: 'default',
  },
};

export const Success: Story = {
  args: {
    bars: generateBars(30, 100),
    labels: generateLabels(30, 5, i => `Day ${i + 1}`),
    ariaLabel: 'Successful deployments per day',
    variant: 'success',
  },
};

export const Destructive: Story = {
  args: {
    bars: generateBars(24, 15),
    labels: generateLabels(24, 4, i => `${i}:00`),
    ariaLabel: 'Errors per hour',
    variant: 'destructive',
  },
};

export const Muted: Story = {
  args: {
    bars: generateBars(90, 30),
    labels: generateLabels(90, 15, i => `${i}d`),
    ariaLabel: 'Background activity (90 days)',
    variant: 'muted',
  },
};
```

**Step 2: Verify Storybook builds**

Run: `cd frontend && npm run build-storybook`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add frontend/src/app/shared/ui/histogram-timeline.stories.ts
git commit -m "feat(histogram-timeline): add Storybook stories"
```

---

## Task 4: Run full lint suite and fix any issues

**Files:**
- Possibly modify: `frontend/.cspell.json` (add "histogram" if cspell flags it)

**Step 1: Run full lint**

Run: `cd frontend && npm run lint:all`
Expected: All clean (tsc, eslint, stylelint, cspell).

**Step 2: If cspell flags "histogram", add it to the words list**

In `frontend/.cspell.json`, add `"histogram"` to the `words` array if needed.

**Step 3: Re-run lint if anything was fixed**

Run: `cd frontend && npm run lint:all`
Expected: 0 errors.

**Step 4: Commit (only if changes were made)**

```bash
git add frontend/.cspell.json
git commit -m "chore: add histogram to cspell dictionary"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | CSS in design system | `packages/design-system/components.css` |
| 2 | Angular component + tests (TDD) | `histogram-timeline.component.ts`, `.spec.ts` |
| 3 | Storybook stories | `histogram-timeline.stories.ts` |
| 4 | Lint check + cspell fix | `.cspell.json` (if needed) |
