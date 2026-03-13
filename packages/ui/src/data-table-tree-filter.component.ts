import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { DataTableComponent } from './data-table.component';
import type { FilterPosition } from './data-table-filter.types';
import type {
  FlatTreeNode,
  TreeFilterNode,
  TreeSelectionChangeEvent,
} from './data-table-tree-filter.types';

@Component({
  selector: 'ui-data-table-tree-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'data-table-filter tree-filter',
    '[attr.data-position]': 'position()',
    '[attr.data-filter-id]': 'filterId()',
  },
  template: `
    @for (node of visibleNodes(); track node.path.join('.')) {
      <div class="tree-filter-node" [style.padding-left.rem]="node.depth * 1.25">
        @if (node.expandable) {
          <button class="tree-filter-toggle"
            (click)="toggleExpand(node.path)" type="button">
            <span [class.tree-filter-arrow-open]="node.expanded"
              class="tree-filter-arrow">&#9654;</span>
          </button>
        } @else {
          <span class="tree-filter-spacer"></span>
        }
        @if (multi()) {
          <input type="checkbox" [checked]="node.selected"
            [indeterminate]="node.indeterminate"
            (click)="toggleSelect(node.path)" class="tree-filter-input" />
        } @else {
          <input type="radio" [checked]="node.selected" [name]="filterId()"
            (click)="toggleSelect(node.path)" class="tree-filter-input" />
        }
        <span class="tree-filter-label">{{ node.label }}</span>
      </div>
    }
  `,
})
export class DataTableTreeFilterComponent<T = Record<string, unknown>>
  implements OnInit
{
  readonly filterId = input.required<string>();
  readonly column = input.required<string>();
  readonly options = input.required<TreeFilterNode[]>();
  readonly multi = input(false);
  readonly position = input<FilterPosition>('left');
  readonly dependsOn = input<string | null>(null);

  readonly selectionChange = output<TreeSelectionChangeEvent>();

  readonly table = inject(DataTableComponent, { optional: false });
  private readonly destroyRef = inject(DestroyRef);

  private readonly expandedKeys = signal(new Set<string>());
  private readonly selectedKeys = signal(new Set<string>());

  readonly flatNodes = computed(() => flatten(this.options(), []));

  readonly visibleNodes = computed(() => {
    const all = this.flatNodes();
    const expanded = this.expandedKeys();
    const selected = this.selectedKeys();
    return all
      .filter((n) => n.depth === 0 || isAncestorExpanded(n.path, expanded))
      .map((n) => ({
        ...n,
        expanded: expanded.has(pathKey(n.path)),
        ...this.selectionState(n, selected),
      }));
  });

  readonly value = computed(() => {
    const sel = this.selectedKeys();
    if (sel.size === 0) return null;
    const all = this.flatNodes();
    return all.filter((n) => sel.has(pathKey(n.path))).map((n) => n.path);
  });

  ngOnInit(): void {
    if (!this.table) {
      throw new Error(
        'ui-data-table-tree-filter must be used inside a ui-data-table',
      );
    }
    this.table.registerFilter(this);
    this.destroyRef.onDestroy(() => this.table.unregisterFilter(this));
  }

  applyFilter(rows: T[]): T[] {
    const paths = this.value();
    if (!paths || paths.length === 0) return rows;
    const col = this.column();
    return rows.filter((row) => {
      const cellPath = (row as Record<string, unknown>)[col];
      if (!Array.isArray(cellPath)) return false;
      return paths.some((selPath) => isPathPrefix(selPath, cellPath));
    });
  }

  toggleExpand(path: string[]): void {
    const key = pathKey(path);
    this.expandedKeys.update((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  toggleSelect(path: string[]): void {
    const key = pathKey(path);
    const isMulti = this.multi();
    const all = this.flatNodes();
    const descendants = all.filter(
      (n) => n.path.length > path.length && isPathPrefix(path, n.path),
    );

    this.selectedKeys.update((prev) => {
      const next = isMulti ? new Set(prev) : new Set<string>();
      const wasSelected = prev.has(key);
      if (wasSelected) {
        next.delete(key);
        for (const d of descendants) next.delete(pathKey(d.path));
      } else {
        next.add(key);
        for (const d of descendants) next.add(pathKey(d.path));
      }
      return next;
    });

    this.emitChange();
  }

  private selectionState(
    node: FlatTreeNode,
    selected: Set<string>,
  ): { selected: boolean; indeterminate: boolean } {
    const isSel = selected.has(pathKey(node.path));
    if (!node.expandable) return { selected: isSel, indeterminate: false };

    const all = this.flatNodes();
    const descs = all.filter(
      (n) =>
        !n.expandable &&
        n.path.length > node.path.length &&
        isPathPrefix(node.path, n.path),
    );
    if (descs.length === 0) return { selected: isSel, indeterminate: false };

    const selCount = descs.filter((d) => selected.has(pathKey(d.path))).length;
    if (selCount === 0) return { selected: false, indeterminate: false };
    if (selCount === descs.length) return { selected: true, indeterminate: false };
    return { selected: false, indeterminate: true };
  }

  private emitChange(): void {
    const paths = this.value();
    this.selectionChange.emit({
      filterId: this.filterId(),
      selectedPaths: paths ?? [],
    });
  }
}

function pathKey(path: string[]): string {
  return path.join('\0');
}

function isPathPrefix(prefix: string[], full: string[]): boolean {
  if (prefix.length > full.length) return false;
  return prefix.every((v, i) => v === full[i]);
}

function isAncestorExpanded(path: string[], expanded: Set<string>): boolean {
  for (let i = 1; i < path.length; i++) {
    if (!expanded.has(pathKey(path.slice(0, i)))) return false;
  }
  return true;
}

function flatten(
  nodes: TreeFilterNode[],
  parentPath: string[],
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];
  for (const node of nodes) {
    const path = [...parentPath, node.value];
    const expandable = !!node.children?.length;
    result.push({
      value: node.value,
      label: node.label ?? node.value,
      path,
      depth: parentPath.length,
      expandable,
      expanded: false,
      selected: false,
      indeterminate: false,
    });
    if (node.children) {
      result.push(...flatten(node.children, path));
    }
  }
  return result;
}
