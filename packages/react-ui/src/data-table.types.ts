export type TableSize = 'compact' | 'default';
export type ColumnAlign = 'start' | 'center' | 'end';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string;
  direction: SortDirection;
}
