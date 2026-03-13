import type { FlatTreeNode, TreeFilterNode } from './data-table-tree-filter.types';

export function pathKey(path: string[]): string {
  return path.join('\0');
}

export function isPathPrefix(prefix: string[], full: string[]): boolean {
  if (prefix.length > full.length) return false;
  return prefix.every((v, i) => v === full[i]);
}

export function isAncestorExpanded(
  path: string[],
  expanded: Set<string>,
): boolean {
  for (let i = 1; i < path.length; i++) {
    if (!expanded.has(pathKey(path.slice(0, i)))) return false;
  }
  return true;
}

export function selectionState(
  node: FlatTreeNode,
  selected: Set<string>,
  allNodes: FlatTreeNode[],
): { selected: boolean; indeterminate: boolean } {
  const isSel = selected.has(pathKey(node.path));
  if (!node.expandable) return { selected: isSel, indeterminate: false };

  const descs = allNodes.filter(
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

export function filterByPaths<T>(
  rows: T[],
  paths: string[][],
  column: string,
): T[] {
  return rows.filter((row) => {
    const cellPath = (row as Record<string, unknown>)[column];
    if (!Array.isArray(cellPath)) return false;
    return paths.some((selPath) => isPathPrefix(selPath, cellPath));
  });
}

export function updateSelection(
  prev: Set<string>,
  key: string,
  descendants: { path: string[] }[],
  multi: boolean,
): Set<string> {
  const next = multi ? new Set(prev) : new Set<string>();
  const wasSelected = prev.has(key);
  if (wasSelected) {
    next.delete(key);
    for (const d of descendants) next.delete(pathKey(d.path));
  } else {
    next.add(key);
    for (const d of descendants) next.add(pathKey(d.path));
  }
  return next;
}

export function flatten(
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
