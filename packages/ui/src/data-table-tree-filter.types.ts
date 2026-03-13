export interface TreeFilterNode {
  readonly value: string;
  readonly label?: string;
  readonly children?: TreeFilterNode[];
}

export interface FlatTreeNode {
  readonly value: string;
  readonly label: string;
  readonly path: string[];
  readonly depth: number;
  readonly expandable: boolean;
  expanded: boolean;
  selected: boolean;
  indeterminate: boolean;
}

export interface TreeSelectionChangeEvent {
  readonly filterId: string;
  readonly selectedPaths: string[][];
}
