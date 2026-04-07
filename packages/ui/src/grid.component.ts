import { ChangeDetectionStrategy, Component, computed, Directive, input } from '@angular/core';

export type GridGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

@Component({
  selector: 'ui-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'layout-grid',
    '[attr.data-gap]': 'gap()',
    '[style.--grid-cols]': 'colsVar()',
    '[style.grid-template-columns]': 'colsTemplate()',
    '[style.flex]': 'fill() ? 1 : null',
    '[style.min-height]': 'fill() ? 0 : null',
  },
  template: `<ng-content />`,
})
export class GridComponent {
  readonly cols = input<number | string | undefined>(undefined);
  readonly gap = input<GridGap>('md');
  readonly fill = input(false);

  protected readonly colsVar = computed(() => {
    const c = this.cols();
    return typeof c === 'number' ? c : null;
  });

  protected readonly colsTemplate = computed(() => {
    const c = this.cols();
    return typeof c === 'string' ? c : null;
  });
}

@Directive({
  selector: '[uiCell]',
  host: {
    '[style.grid-column]': 'gridColumn()',
    '[style.grid-column-start]': 'start() ?? null',
    '[style.grid-row]': 'rowSpan() ? "span " + rowSpan() : null',
  },
})
export class CellDirective {
  readonly span = input<number | 'full' | undefined>(undefined);
  readonly start = input<number | undefined>(undefined);
  readonly rowSpan = input<number | undefined>(undefined);

  protected readonly gridColumn = computed(() => {
    const s = this.span();
    if (s === undefined) return null;
    return s === 'full' ? '1 / -1' : `span ${s}`;
  });
}
