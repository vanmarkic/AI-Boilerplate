import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type CollapsiblePanelVariant = 'default' | 'ghost' | 'outline';
export type CollapsiblePanelSize = 'sm' | 'default' | 'lg';

@Component({
  selector: 'ui-collapsible-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'collapsible-panel',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
  },
  template: `
    <details [open]="open()" (toggle)="onToggle($event)">
      <summary class="collapsible-panel-trigger" [attr.aria-disabled]="disabled() || null">
        <ng-content select="[panelTitle]" />
        <svg
          class="collapsible-panel-chevron"
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
      </summary>
      <div class="collapsible-panel-content">
        <ng-content />
      </div>
    </details>
  `,
})
export class CollapsiblePanelComponent {
  readonly variant = input<CollapsiblePanelVariant>('default');
  readonly size = input<CollapsiblePanelSize>('default');
  readonly open = input(false);
  readonly disabled = input(false);
  readonly openChange = output<boolean>();

  protected onToggle(event: Event): void {
    const details = event.target as HTMLDetailsElement;
    if (this.disabled()) {
      details.open = this.open();
      return;
    }
    this.openChange.emit(details.open);
  }
}
