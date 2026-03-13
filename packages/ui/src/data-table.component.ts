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
import type { SortDirection, SortState, TableSize } from './data-table.types';

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
    <table cdk-table [dataSource]="sortedData()" class="data-table-table">
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
    @if (sortedData().length === 0) {
      <div class="data-table-empty">
        <ng-content select="[emptyState]" />
      </div>
    }
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

  readonly sortChange = output<SortState[]>();

  readonly activeSorts = signal<SortState[]>([]);
  readonly displayedColumns = signal<string[]>([]);

  readonly sortedData = computed(() => {
    const data = [...this.dataSource()];
    const sorts = this.activeSorts();
    if (sorts.length === 0) return data;

    return data.sort((a, b) => {
      for (const sort of sorts) {
        const row = a as Record<string, unknown>;
        const rowB = b as Record<string, unknown>;
        const cmp = this.compare(row[sort.column], rowB[sort.column]);
        if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  });

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

  private compare(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    return String(a).localeCompare(String(b));
  }
}
