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
  TreeFilterNode,
  TreeSelectionChangeEvent,
} from './data-table-tree-filter.types';
import {
  filterByPaths,
  flatten,
  isAncestorExpanded,
  isPathPrefix,
  pathKey,
  selectionState,
  updateSelection,
} from './data-table-tree-filter.utils';

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
      <div class="tree-filter-node" [style.--tree-depth]="node.depth">
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
        ...selectionState(n, selected, all),
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
    return filterByPaths(rows, paths, this.column());
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
    const descendants = this.flatNodes().filter(
      (n) => n.path.length > path.length && isPathPrefix(path, n.path),
    );
    this.selectedKeys.update((prev) =>
      updateSelection(prev, key, descendants, this.multi()),
    );
    this.emitChange();
  }

  private emitChange(): void {
    const paths = this.value();
    this.selectionChange.emit({
      filterId: this.filterId(),
      selectedPaths: paths ?? [],
    });
  }
}
