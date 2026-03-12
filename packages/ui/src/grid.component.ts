import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type GridCols = 1 | 2 | 3 | 4 | 6 | 12;
export type GridGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'ui-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'layout-grid',
    '[style.--grid-cols]': 'cols()',
    '[attr.data-gap]': 'gap()',
  },
  template: `<ng-content />`,
})
export class GridComponent {
  readonly cols = input<GridCols>(1);
  readonly gap = input<GridGap>('md');
}
