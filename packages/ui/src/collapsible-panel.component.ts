import { Component, input } from '@angular/core';

export type CollapsiblePanelVariant = 'default' | 'ghost' | 'outline';
export type CollapsiblePanelSize = 'sm' | 'default' | 'lg';

@Component({
  selector: 'ui-collapsible-panel',
  host: {
    'class': 'collapsible-panel',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
  },
  template: `
    <details [open]="open()">
      <summary class="collapsible-panel-trigger">
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
}
