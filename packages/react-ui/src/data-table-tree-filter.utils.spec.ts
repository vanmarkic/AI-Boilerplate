import type { FlatTreeNode, TreeFilterNode } from './data-table-tree-filter.types';
import {
  flatten,
  filterByPaths,
  isAncestorExpanded,
  isPathPrefix,
  pathKey,
  selectionState,
  updateSelection,
} from './data-table-tree-filter.utils';

/* ── pathKey ───────────────────────────────────────────── */

describe('pathKey', () => {
  it('joins path segments with null byte', () => {
    expect(pathKey(['a', 'b', 'c'])).toBe('a\0b\0c');
  });

  it('returns the value itself for single-segment paths', () => {
    expect(pathKey(['root'])).toBe('root');
  });

  it('returns empty string for empty path', () => {
    expect(pathKey([])).toBe('');
  });
});

/* ── isPathPrefix ──────────────────────────────────────── */

describe('isPathPrefix', () => {
  it('returns true when prefix matches start of full path', () => {
    expect(isPathPrefix(['a'], ['a', 'b'])).toBe(true);
  });

  it('returns true when prefix equals full path', () => {
    expect(isPathPrefix(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('returns false when prefix is longer than full path', () => {
    expect(isPathPrefix(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
  });

  it('returns false when segments do not match', () => {
    expect(isPathPrefix(['x'], ['a', 'b'])).toBe(false);
  });

  it('returns true for empty prefix', () => {
    expect(isPathPrefix([], ['a', 'b'])).toBe(true);
  });
});

/* ── isAncestorExpanded ────────────────────────────────── */

describe('isAncestorExpanded', () => {
  it('returns true for root-level nodes (depth 0, path length 1)', () => {
    expect(isAncestorExpanded(['root'], new Set())).toBe(true);
  });

  it('returns true when all ancestor keys are expanded', () => {
    const expanded = new Set([pathKey(['a']), pathKey(['a', 'b'])]);
    expect(isAncestorExpanded(['a', 'b', 'c'], expanded)).toBe(true);
  });

  it('returns false when an intermediate ancestor is collapsed', () => {
    const expanded = new Set([pathKey(['a'])]);
    // path ['a','b','c'] needs both ['a'] and ['a','b'] expanded
    expect(isAncestorExpanded(['a', 'b', 'c'], expanded)).toBe(false);
  });
});

/* ── selectionState ────────────────────────────────────── */

describe('selectionState', () => {
  const leaf: FlatTreeNode = {
    value: 'x',
    label: 'X',
    path: ['a', 'x'],
    depth: 1,
    expandable: false,
    expanded: false,
    selected: false,
    indeterminate: false,
  };

  const parent: FlatTreeNode = {
    value: 'a',
    label: 'A',
    path: ['a'],
    depth: 0,
    expandable: true,
    expanded: false,
    selected: false,
    indeterminate: false,
  };

  const child1: FlatTreeNode = {
    value: 'c1',
    label: 'C1',
    path: ['a', 'c1'],
    depth: 1,
    expandable: false,
    expanded: false,
    selected: false,
    indeterminate: false,
  };

  const child2: FlatTreeNode = {
    value: 'c2',
    label: 'C2',
    path: ['a', 'c2'],
    depth: 1,
    expandable: false,
    expanded: false,
    selected: false,
    indeterminate: false,
  };

  const allNodes = [parent, child1, child2];

  it('returns selected=true for a selected leaf', () => {
    const selected = new Set([pathKey(leaf.path)]);
    expect(selectionState(leaf, selected, [leaf])).toEqual({
      selected: true,
      indeterminate: false,
    });
  });

  it('returns selected=false for an unselected leaf', () => {
    expect(selectionState(leaf, new Set(), [leaf])).toEqual({
      selected: false,
      indeterminate: false,
    });
  });

  it('returns selected=true when all children are selected', () => {
    const selected = new Set([pathKey(child1.path), pathKey(child2.path)]);
    expect(selectionState(parent, selected, allNodes)).toEqual({
      selected: true,
      indeterminate: false,
    });
  });

  it('returns indeterminate when some children are selected', () => {
    const selected = new Set([pathKey(child1.path)]);
    expect(selectionState(parent, selected, allNodes)).toEqual({
      selected: false,
      indeterminate: true,
    });
  });

  it('returns selected=false when no children are selected', () => {
    expect(selectionState(parent, new Set(), allNodes)).toEqual({
      selected: false,
      indeterminate: false,
    });
  });
});

/* ── filterByPaths ─────────────────────────────────────── */

describe('filterByPaths', () => {
  const data = [
    { category: ['fruit', 'apple'] },
    { category: ['fruit', 'banana'] },
    { category: ['veg', 'carrot'] },
    { category: 'not-an-array' },
  ];

  it('returns rows whose column path starts with a selected path', () => {
    const result = filterByPaths(data, [['fruit']], 'category');
    expect(result).toEqual([data[0], data[1]]);
  });

  it('filters exact path match', () => {
    const result = filterByPaths(data, [['fruit', 'apple']], 'category');
    expect(result).toEqual([data[0]]);
  });

  it('excludes rows where column value is not an array', () => {
    const result = filterByPaths(data, [['not-an-array']], 'category');
    expect(result).toEqual([]);
  });

  it('returns empty array when no paths match', () => {
    const result = filterByPaths(data, [['dairy']], 'category');
    expect(result).toEqual([]);
  });
});

/* ── updateSelection ───────────────────────────────────── */

describe('updateSelection', () => {
  const key = pathKey(['a']);
  const descendants = [{ path: ['a', 'c1'] }, { path: ['a', 'c2'] }];

  it('adds key and descendants when not previously selected', () => {
    const result = updateSelection(new Set(), key, descendants, true);
    expect(result.has(key)).toBe(true);
    expect(result.has(pathKey(['a', 'c1']))).toBe(true);
    expect(result.has(pathKey(['a', 'c2']))).toBe(true);
  });

  it('removes key and descendants when previously selected', () => {
    const prev = new Set([key, pathKey(['a', 'c1']), pathKey(['a', 'c2'])]);
    const result = updateSelection(prev, key, descendants, true);
    expect(result.has(key)).toBe(false);
    expect(result.has(pathKey(['a', 'c1']))).toBe(false);
    expect(result.has(pathKey(['a', 'c2']))).toBe(false);
  });

  it('in single mode, clears previous selection before adding', () => {
    const prev = new Set([pathKey(['other'])]);
    const result = updateSelection(prev, key, [], false);
    expect(result.has(key)).toBe(true);
    expect(result.has(pathKey(['other']))).toBe(false);
  });

  it('in multi mode, preserves previous selection', () => {
    const prev = new Set([pathKey(['other'])]);
    const result = updateSelection(prev, key, [], true);
    expect(result.has(key)).toBe(true);
    expect(result.has(pathKey(['other']))).toBe(true);
  });
});

/* ── flatten ───────────────────────────────────────────── */

describe('flatten', () => {
  const tree: TreeFilterNode[] = [
    {
      value: 'fruit',
      label: 'Fruits',
      children: [{ value: 'apple', label: 'Apple' }, { value: 'banana' }],
    },
    { value: 'veg' },
  ];

  it('flattens a tree into a list of FlatTreeNodes', () => {
    const result = flatten(tree, []);
    expect(result).toHaveLength(4);
  });

  it('sets correct depth for each node', () => {
    const result = flatten(tree, []);
    expect(result[0].depth).toBe(0); // fruit
    expect(result[1].depth).toBe(1); // apple
    expect(result[2].depth).toBe(1); // banana
    expect(result[3].depth).toBe(0); // veg
  });

  it('marks parent nodes as expandable', () => {
    const result = flatten(tree, []);
    expect(result[0].expandable).toBe(true); // fruit has children
    expect(result[1].expandable).toBe(false); // apple is leaf
    expect(result[3].expandable).toBe(false); // veg is leaf
  });

  it('builds correct paths', () => {
    const result = flatten(tree, []);
    expect(result[0].path).toEqual(['fruit']);
    expect(result[1].path).toEqual(['fruit', 'apple']);
    expect(result[2].path).toEqual(['fruit', 'banana']);
    expect(result[3].path).toEqual(['veg']);
  });

  it('uses value as label when label is not provided', () => {
    const result = flatten(tree, []);
    expect(result[2].label).toBe('banana');
    expect(result[3].label).toBe('veg');
  });

  it('uses explicit label when provided', () => {
    const result = flatten(tree, []);
    expect(result[0].label).toBe('Fruits');
    expect(result[1].label).toBe('Apple');
  });

  it('returns empty array for empty input', () => {
    expect(flatten([], [])).toEqual([]);
  });
});
