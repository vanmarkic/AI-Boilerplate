import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { DataTableComponent } from './data-table.component';
import type {
  FilterChangeEvent,
  FilterFn,
  FilterOperator,
  FilterPosition,
} from './data-table-filter.types';

@Component({
  selector: 'ui-data-table-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'data-table-filter',
    '[attr.data-position]': 'position()',
    '[attr.data-filter-id]': 'filterId()',
  },
  template: `<ng-content />`,
})
export class DataTableFilterComponent<T = Record<string, unknown>>
  implements OnInit
{
  readonly filterId = input.required<string>();
  readonly column = input.required<string>();
  readonly operator = input<FilterOperator>('equals');
  readonly value = input<unknown>(null);
  readonly position = input<FilterPosition>('top');
  readonly dependsOn = input<string | null>(null);
  readonly filterFn = input<FilterFn<T> | null>(null);

  readonly filterChange = output<FilterChangeEvent>();

  readonly table = inject(DataTableComponent, { optional: false });
  private readonly destroyRef = inject(DestroyRef);

  readonly state = computed(() => ({
    filterId: this.filterId(),
    column: this.column(),
    value: this.value(),
    operator: this.operator(),
    position: this.position(),
    dependsOn: this.dependsOn(),
  }));

  ngOnInit(): void {
    if (!this.table) {
      throw new Error(
        'ui-data-table-filter must be used inside a ui-data-table',
      );
    }
    this.table.registerFilter(this);
    this.destroyRef.onDestroy(() => this.table.unregisterFilter(this));
  }

  applyFilter(rows: T[]): T[] {
    const val = this.value();
    if (val === null || val === undefined || val === '') return rows;

    const col = this.column();
    const op = this.operator();
    const custom = this.filterFn();

    return rows.filter((row) => {
      const rec = row as Record<string, unknown>;
      const cellValue = rec[col];

      if (op === 'custom' && custom) {
        return custom(row, val);
      }

      return matchOperator(cellValue, val, op);
    });
  }
}

function toComparable(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  return Number(v);
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function matchOperator(
  cellValue: unknown,
  filterValue: unknown,
  op: FilterOperator,
): boolean {
  switch (op) {
    case 'equals':
      return isEqual(cellValue, filterValue);
    case 'not-equals':
      return !isEqual(cellValue, filterValue);
    case 'contains':
      return String(cellValue)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    case 'gt':
      return toComparable(cellValue) > toComparable(filterValue);
    case 'lt':
      return toComparable(cellValue) < toComparable(filterValue);
    case 'gte':
      return toComparable(cellValue) >= toComparable(filterValue);
    case 'lte':
      return toComparable(cellValue) <= toComparable(filterValue);
    case 'in':
      return Array.isArray(filterValue) &&
        filterValue.some((v) => isEqual(cellValue, v));
    case 'custom':
      return true;
    default:
      return true;
  }
}
