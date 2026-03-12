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
  selector: 'ui-histogram-timeline',
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
  readonly ariaLabel = input.required<string>();
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
