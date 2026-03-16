import type { QueryList } from '@angular/core';

import type { DataTableColumnComponent } from './data-table-column.component';
import type { SortDirection, SortState } from './data-table.types';
import { compareValues } from './data-table.utils';

/** Compute the next sort state after toggling a column. */
export function nextSortState(
  current: SortState[],
  columnDef: string,
  multiSort: boolean,
): SortState[] {
  const existing = current.find((s) => s.column === columnDef);

  if (!existing) {
    const entry: SortState = { column: columnDef, direction: 'asc' };
    return multiSort ? [...current, entry] : [entry];
  }
  if (existing.direction === 'asc') {
    return current.map((s) =>
      s.column === columnDef
        ? { ...s, direction: 'desc' as SortDirection }
        : s,
    );
  }
  return current.filter((s) => s.column !== columnDef);
}

/** Sort rows by multiple sort states (stable). */
export function sortRows<T>(data: T[], sorts: SortState[]): T[] {
  if (sorts.length === 0) return data;
  return [...data].sort((a, b) => {
    for (const sort of sorts) {
      const rowA = a as Record<string, unknown>;
      const rowB = b as Record<string, unknown>;
      const cmp = compareValues(rowA[sort.column], rowB[sort.column]);
      if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

/** Push active sort direction and badge index into each column signal. */
export function syncColumnSortState(
  columns: QueryList<DataTableColumnComponent> | undefined,
  sorts: SortState[],
  multiSort: boolean,
): void {
  if (!columns) return;
  for (const col of columns) {
    const idx = sorts.findIndex((s) => s.column === col.columnDef());
    col.activeSortDir.set(idx >= 0 ? sorts[idx].direction : null);
    col.sortIdx.set(multiSort && sorts.length > 1 ? idx : null);
  }
}
