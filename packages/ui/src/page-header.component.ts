import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-header' },
  template: `
    <div class="page-header-heading">
      <h1 class="page-header-title">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="page-header-subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="page-header-actions">
      <ng-content select="[pageHeaderActions]" />
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input('');
  readonly subtitle = input('');
}
