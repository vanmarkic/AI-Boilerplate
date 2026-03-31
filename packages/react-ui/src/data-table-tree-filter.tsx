import { type HTMLAttributes, useCallback, useMemo, useState } from 'react';
import type { FilterPosition } from './data-table-filter.types';
import type {
  TreeFilterNode,
  TreeSelectionChangeEvent,
} from './data-table-tree-filter.types';
import {
  flatten,
  isAncestorExpanded,
  isPathPrefix,
  pathKey,
  selectionState,
  updateSelection,
} from './data-table-tree-filter.utils';

export interface DataTableTreeFilterProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  filterId: string;
  column: string;
  options: TreeFilterNode[];
  multi?: boolean;
  position?: FilterPosition;
  onSelectionChange?: (event: TreeSelectionChangeEvent) => void;
}

export function DataTableTreeFilter({
  filterId,
  column,
  options,
  multi = false,
  position = 'left',
  onSelectionChange,
  className,
  ...props
}: DataTableTreeFilterProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const flatNodes = useMemo(() => flatten(options, []), [options]);

  const visibleNodes = useMemo(() => {
    return flatNodes
      .filter(
        (n) => n.depth === 0 || isAncestorExpanded(n.path, expandedKeys),
      )
      .map((n) => ({
        ...n,
        expanded: expandedKeys.has(pathKey(n.path)),
        ...selectionState(n, selectedKeys, flatNodes),
      }));
  }, [flatNodes, expandedKeys, selectedKeys]);

  const toggleExpand = useCallback((path: string[]) => {
    const key = pathKey(path);
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleSelect = useCallback(
    (path: string[]) => {
      const key = pathKey(path);
      const descendants = flatNodes.filter(
        (n) => n.path.length > path.length && isPathPrefix(path, n.path),
      );
      setSelectedKeys((prev) => {
        const next = updateSelection(prev, key, descendants, multi);
        const paths = flatNodes
          .filter((n) => next.has(pathKey(n.path)))
          .map((n) => n.path);
        onSelectionChange?.({ filterId, selectedPaths: paths });
        return next;
      });
    },
    [flatNodes, multi, filterId, onSelectionChange],
  );

  return (
    <div
      className={
        className
          ? `data-table-filter tree-filter ${className}`
          : 'data-table-filter tree-filter'
      }
      data-position={position}
      data-filter-id={filterId}
      {...props}
    >
      {visibleNodes.map((node) => (
        <div
          key={node.path.join('.')}
          className="tree-filter-node"
          style={{ '--tree-depth': node.depth } as React.CSSProperties}
        >
          {node.expandable ? (
            <button
              className="tree-filter-toggle"
              onClick={() => toggleExpand(node.path)}
              type="button"
            >
              <span
                className={
                  node.expanded
                    ? 'tree-filter-arrow tree-filter-arrow-open'
                    : 'tree-filter-arrow'
                }
              >
                &#9654;
              </span>
            </button>
          ) : (
            <span className="tree-filter-spacer" />
          )}
          {multi ? (
            <input
              type="checkbox"
              checked={node.selected}
              ref={(el) => {
                if (el) el.indeterminate = node.indeterminate;
              }}
              onChange={() => toggleSelect(node.path)}
              className="tree-filter-input"
            />
          ) : (
            <input
              type="radio"
              checked={node.selected}
              name={filterId}
              onChange={() => toggleSelect(node.path)}
              className="tree-filter-input"
            />
          )}
          <span className="tree-filter-label">{node.label}</span>
        </div>
      ))}
    </div>
  );
}
