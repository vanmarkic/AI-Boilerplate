import { type HTMLAttributes, type ReactNode } from 'react';
import type {
  FilterChangeEvent,
  FilterFn,
  FilterOperator,
  FilterPosition,
} from './data-table-filter.types';

export interface DataTableFilterProps<T = Record<string, unknown>>
  extends HTMLAttributes<HTMLDivElement> {
  filterId: string;
  column: string;
  operator?: FilterOperator;
  value?: unknown;
  position?: FilterPosition;
  dependsOn?: string | null;
  filterFn?: FilterFn<T> | null;
  onFilterChange?: (event: FilterChangeEvent) => void;
  children?: ReactNode;
}

export function DataTableFilter<T = Record<string, unknown>>({
  filterId,
  column,
  operator = 'equals',
  value = null,
  position = 'top',
  className,
  children,
  ...props
}: DataTableFilterProps<T>) {
  return (
    <div
      className={
        className ? `data-table-filter ${className}` : 'data-table-filter'
      }
      data-position={position}
      data-filter-id={filterId}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Filter application utilities ────────────────────── */

function toComparable(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  return Number(v);
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
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
      return (
        Array.isArray(filterValue) &&
        filterValue.some((v) => isEqual(cellValue, v))
      );
    case 'custom':
      return true;
    default:
      return true;
  }
}

export interface FilterConfig<T = Record<string, unknown>> {
  filterId: string;
  column: string;
  operator: FilterOperator;
  value: unknown;
  filterFn?: FilterFn<T> | null;
}

/** Apply a set of filters to rows. Filters are combined with AND logic. */
export function applyFilters<T = Record<string, unknown>>(
  rows: T[],
  filters: FilterConfig<T>[],
): T[] {
  let result = rows;
  for (const filter of filters) {
    const { column, operator, value, filterFn } = filter;
    if (value === null || value === undefined || value === '') continue;

    result = result.filter((row) => {
      const rec = row as Record<string, unknown>;
      const cellValue = rec[column];

      if (operator === 'custom' && filterFn) {
        return filterFn(row, value);
      }

      return matchOperator(cellValue, value, operator);
    });
  }
  return result;
}
