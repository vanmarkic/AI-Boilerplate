import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export type CardGroupMode = 'aggregated' | 'disaggregated';

@Component({
  selector: 'ui-card-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'card-group',
    '[attr.data-mode]': 'mode()',
  },
  template: `
    <button
      type="button"
      class="card-group-toggle"
      (click)="toggle()"
      [attr.aria-expanded]="mode() === 'disaggregated'"
    >
      <span class="card-group-title">{{ title() }}</span>
      <span class="card-group-count">{{ count() }}</span>
      <svg
        class="card-group-chevron"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    @if (mode() === 'aggregated') {
      <div class="card-group-summary">
        <ng-content select="[groupSummary]" />
      </div>
    } @else {
      <div class="card-group-items">
        <ng-content />
      </div>
    }
  `,
})
export class CardGroupComponent {
  readonly title = input.required<string>();
  readonly count = input(0);
  readonly mode = model<CardGroupMode>('aggregated');

  toggle(): void {
    this.mode.set(
      this.mode() === 'aggregated' ? 'disaggregated' : 'aggregated',
    );
  }
}
