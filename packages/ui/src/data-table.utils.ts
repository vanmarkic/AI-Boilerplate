import type { FilterPosition } from './data-table-filter.types';

export type FilterRef = {
  applyFilter(rows: unknown[]): unknown[];
  position: () => FilterPosition;
  dependsOn: () => string | null;
  filterId: () => string;
  value: () => unknown;
};

export function applyGroup<T>(
  group: FilterRef[],
  data: T[],
  logic: 'and' | 'or',
): T[] {
  const active = group.filter(
    (f) => f.value() !== null && f.value() !== undefined && f.value() !== '',
  );
  if (active.length === 0) return [...data];

  if (logic === 'or') {
    const seen = new Set<T>();
    for (const filter of active) {
      for (const row of filter.applyFilter(data) as T[]) {
        seen.add(row);
      }
    }
    return data.filter((row) => seen.has(row));
  }

  const sorted = topoSort(active);
  let result: T[] = [...data];
  for (const filter of sorted) {
    result = filter.applyFilter(result) as T[];
  }
  return result;
}

export function topoSort(filters: FilterRef[]): FilterRef[] {
  const byId = new Map(filters.map((f) => [f.filterId(), f]));
  const visited = new Set<string>();
  const result: FilterRef[] = [];

  const visit = (f: FilterRef): void => {
    const id = f.filterId();
    if (visited.has(id)) return;
    visited.add(id);
    const depId = f.dependsOn();
    if (depId && byId.has(depId)) visit(byId.get(depId)!);
    result.push(f);
  };

  for (const f of filters) visit(f);
  return result;
}

/** Apply master + secondary filter groups in sequence. */
export function applyFilterPipeline<T>(
  allFilters: FilterRef[],
  data: T[],
  masterPosition: FilterPosition,
  logic: 'and' | 'or',
): T[] {
  if (allFilters.length === 0) return [...data];

  const master = allFilters.filter((f) => f.position() === masterPosition);
  const secondary = allFilters.filter((f) => f.position() !== masterPosition);

  const afterMaster = applyGroup(master, data, logic);
  return applyGroup(secondary, afterMaster, logic);
}

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b));
}
