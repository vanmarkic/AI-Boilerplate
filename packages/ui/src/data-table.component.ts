import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  QueryList,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkTable, CdkTableModule } from '@angular/cdk/table';

import { DataTableColumnComponent } from './data-table-column.component';
import type { FilterLogic, FilterPosition } from './data-table-filter.types';
import type { SortDirection, SortState, TableSize } from './data-table.types';
import { type FilterRef, applyGroup, compareValues } from './data-table.utils';

@Component({
  selector: 'ui-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTableModule],
  host: {
    'class': 'data-table',
    '[attr.data-size]': 'size()',
    '[attr.data-striped]': 'striped()',
  },
  template: `
    @if (hasTopFilters()) {
      <div class="data-table-filters-top">
        <ng-content select="ui-data-table-filter[position=top], ui-data-table-tree-filter[position=top]" />
      </div>
    }
    <div class="data-table-body-wrapper">
      @if (hasLeftFilters()) {
        <div class="data-table-filters-left">
          <ng-content select="ui-data-table-filter[position=left], ui-data-table-tree-filter[position=left]" />
        </div>
      }
      <div class="data-table-content">
        <table cdk-table [dataSource]="displayData()" class="data-table-table">
          <ng-content />
          <tr
            cdk-header-row
            *cdkHeaderRowDef="displayedColumns()"
            class="data-table-header-row"
          ></tr>
          <tr
            cdk-row
            *cdkRowDef="let row; columns: displayedColumns()"
            class="data-table-row"
          ></tr>
        </table>
        @if (displayData().length === 0) {
          <div class="data-table-empty">
            <ng-content select="[emptyState]" />
          </div>
        }
      </div>
    </div>
  `,
})
export class DataTableComponent<T = Record<string, unknown>>
  implements AfterViewInit
{
  readonly dataSource = input.required<T[]>();
  readonly defaultSort = input<SortState[]>([]);
  readonly multiSort = input(false);
  readonly size = input<TableSize>('default');
  readonly striped = input(false);
  readonly filterLogic = input<FilterLogic>('and');
  readonly masterFilterPosition = input<FilterPosition>('top');

  readonly sortChange = output<SortState[]>();

  readonly activeSorts = signal<SortState[]>([]);
  readonly displayedColumns = signal<string[]>([]);

  private readonly filters = signal<FilterRef[]>([]);

  readonly hasTopFilters = computed(() =>
    this.filters().some((f) => f.position() === 'top'),
  );

  readonly hasLeftFilters = computed(() =>
    this.filters().some((f) => f.position() === 'left'),
  );

  readonly filteredData = computed(() => {
    const data = this.dataSource();
    const allFilters = this.filters();
    if (allFilters.length === 0) return [...data];

    const masterPos = this.masterFilterPosition();
    const logic = this.filterLogic();
    const master = allFilters.filter((f) => f.position() === masterPos);
    const secondary = allFilters.filter((f) => f.position() !== masterPos);

    const afterMaster = applyGroup(master, data, logic);
    return applyGroup(secondary, afterMaster, logic);
  });

  readonly displayData = computed(() => {
    const data = [...this.filteredData()];
    const sorts = this.activeSorts();
    if (sorts.length === 0) return data;

    return data.sort((a, b) => {
      for (const sort of sorts) {
        const rowA = a as Record<string, unknown>;
        const rowB = b as Record<string, unknown>;
        const cmp = compareValues(rowA[sort.column], rowB[sort.column]);
        if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  });

  /** @deprecated Use displayData() instead. Kept for backwards compat. */
  readonly sortedData = this.displayData;

  @ContentChildren(DataTableColumnComponent, { descendants: true })
  columns!: QueryList<DataTableColumnComponent>;

  @ViewChild(CdkTable, { static: true }) table!: CdkTable<T>;

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const sorts = this.activeSorts();
      this.syncColumnSortState(sorts);
    });
  }

  registerFilter(filter: FilterRef): void {
    this.filters.update((prev) => [...prev, filter]);
  }

  unregisterFilter(filter: FilterRef): void {
    this.filters.update((prev) => prev.filter((f) => f !== filter));
  }

  ngAfterViewInit(): void {
    this.activeSorts.set(this.defaultSort());
    this.registerColumns();

    const sub = this.columns.changes.subscribe(() => {
      this.registerColumns();
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  toggleSort(columnDef: string): void {
    const current = this.activeSorts();
    const existing = current.find((s) => s.column === columnDef);

    let next: SortState[];
    if (!existing) {
      const entry: SortState = { column: columnDef, direction: 'asc' };
      next = this.multiSort() ? [...current, entry] : [entry];
    } else if (existing.direction === 'asc') {
      next = current.map((s) =>
        s.column === columnDef ? { ...s, direction: 'desc' as SortDirection } : s,
      );
    } else {
      next = current.filter((s) => s.column !== columnDef);
    }

    this.activeSorts.set(next);
    this.sortChange.emit(next);
  }

  private registerColumns(): void {
    const names: string[] = [];
    const sorted = this.columns.toArray();

    for (const col of sorted) {
      const name = col.columnDef();
      col.column.name = name;
      names.push(name);
      this.table.addColumnDef(col.column);
      col.sortCallback = (def: string) => this.toggleSort(def);
    }

    this.displayedColumns.set(names);
    this.syncColumnSortState(this.activeSorts());
  }

  private syncColumnSortState(sorts: SortState[]): void {
    if (!this.columns) return;
    for (const col of this.columns) {
      const idx = sorts.findIndex((s) => s.column === col.columnDef());
      col.activeSortDir.set(idx >= 0 ? sorts[idx].direction : null);
      col.sortIdx.set(this.multiSort() && sorts.length > 1 ? idx : null);
    }
  }

}
