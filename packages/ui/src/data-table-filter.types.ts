export type FilterPosition = 'top' | 'left';
export type FilterLogic = 'and' | 'or';
export type FilterOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'in'
  | 'custom';

export type FilterFn<T = Record<string, unknown>> = (
  row: T,
  value: unknown,
) => boolean;

export interface FilterState {
  readonly filterId: string;
  readonly column: string;
  readonly value: unknown;
  readonly operator: FilterOperator;
  readonly position: FilterPosition;
  readonly dependsOn: string | null;
}

export interface FilterChangeEvent {
  readonly filterId: string;
  readonly column: string;
  readonly value: unknown;
}
