import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SidebarSide = 'left' | 'right';

@Component({
  selector: 'ui-sidebar-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'sidebar-layout',
    '[attr.data-side]': 'side()',
  },
  template: `
    <aside class="sidebar-layout-sidebar">
      <ng-content select="[sidebar]" />
    </aside>
    <div class="sidebar-layout-main">
      <ng-content />
    </div>
  `,
})
export class SidebarLayoutComponent {
  readonly side = input<SidebarSide>('left');
}
