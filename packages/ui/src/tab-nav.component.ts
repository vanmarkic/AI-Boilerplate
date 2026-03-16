import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-tab-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tab-nav' },
  template: `<ng-content />`,
})
export class TabNavComponent {}
