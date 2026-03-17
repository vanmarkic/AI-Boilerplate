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
import type { SortState, TableSize } from './data-table.types';
import { type FilterRef, applyFilterPipeline } from './data-table.utils';
import { nextSortState, sortRows, syncColumnSortState } from './data-table.sort';

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
          <tr cdk-header-row *cdkHeaderRowDef="displayedColumns()" class="data-table-header-row"></tr>
          <tr
            cdk-row
            *cdkRowDef="let row; columns: displayedColumns()"
            class="data-table-row"
            [attr.data-clickable]="clickableRows() || null"
            [attr.tabindex]="clickableRows() ? 0 : null"
            (click)="onRowClick(row)"
            (keydown.enter)="onRowClick(row)"
          ></tr>
        </table>
        @if (displayData().length === 0) {
          <div class="data-table-empty"><ng-content select="[emptyState]" /></div>
        }
      </div>
    </div>
  `,
})
export class DataTableComponent<T = Record<string, unknown>> implements AfterViewInit {
  readonly dataSource = input.required<T[]>();
  readonly defaultSort = input<SortState[]>([]);
  readonly multiSort = input(false);
  readonly size = input<TableSize>('default');
  readonly striped = input(false);
  readonly clickableRows = input(false);
  readonly filterLogic = input<FilterLogic>('and');
  readonly masterFilterPosition = input<FilterPosition>('top');
  readonly sortChange = output<SortState[]>();
  readonly rowClick = output<T>();
  readonly activeSorts = signal<SortState[]>([]);
  readonly displayedColumns = signal<string[]>([]);
  private readonly filters = signal<FilterRef[]>([]);

  readonly hasTopFilters = computed(() => this.filters().some((f) => f.position() === 'top'));
  readonly hasLeftFilters = computed(() => this.filters().some((f) => f.position() === 'left'));
  readonly filteredData = computed(() =>
    applyFilterPipeline(this.filters(), this.dataSource(), this.masterFilterPosition(), this.filterLogic()),
  );
  readonly displayData = computed(() => sortRows(this.filteredData(), this.activeSorts()));
  /** @deprecated Use displayData() instead. */
  readonly sortedData = this.displayData;

  @ContentChildren(DataTableColumnComponent, { descendants: true })
  columns!: QueryList<DataTableColumnComponent>;
  @ViewChild(CdkTable, { static: true }) table!: CdkTable<T>;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => { syncColumnSortState(this.columns, this.activeSorts(), this.multiSort()); });
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
    const sub = this.columns.changes.subscribe(() => { this.registerColumns(); });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  onRowClick(row: T): void {
    if (this.clickableRows()) this.rowClick.emit(row);
  }

  toggleSort(columnDef: string): void {
    const next = nextSortState(this.activeSorts(), columnDef, this.multiSort());
    this.activeSorts.set(next);
    this.sortChange.emit(next);
  }

  private registerColumns(): void {
    const names: string[] = [];
    for (const col of this.columns.toArray()) {
      const name = col.columnDef();
      col.column.name = name;
      names.push(name);
      this.table.addColumnDef(col.column);
      col.sortCallback = (def: string) => this.toggleSort(def);
    }
    this.displayedColumns.set(names);
    syncColumnSortState(this.columns, this.activeSorts(), this.multiSort());
  }
}
