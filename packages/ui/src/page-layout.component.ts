import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-page-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-layout' },
  template: `
    <header class="page-layout-header">
      <ng-content select="[pageHeader]" />
    </header>
    <main class="page-layout-main">
      <ng-content />
    </main>
    <footer class="page-layout-footer">
      <ng-content select="[pageFooter]" />
    </footer>
  `,
})
export class PageLayoutComponent {}
