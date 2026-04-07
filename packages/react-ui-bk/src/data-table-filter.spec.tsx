import { render, screen } from '@testing-library/react';
import { DataTableFilter, applyFilters, type FilterConfig } from './data-table-filter';

describe('DataTableFilter', () => {
  it('renders children inside a wrapper div', () => {
    render(
      <DataTableFilter filterId="f1" column="name">
        <span>Filter content</span>
      </DataTableFilter>,
    );
    expect(screen.getByText('Filter content')).toBeInTheDocument();
  });

  it('sets data-filter-id and data-position attributes', () => {
    const { container } = render(
      <DataTableFilter filterId="f1" column="name" position="left">
        Filter
      </DataTableFilter>,
    );
    const div = container.firstElementChild!;
    expect(div).toHaveAttribute('data-filter-id', 'f1');
    expect(div).toHaveAttribute('data-position', 'left');
  });

  it('defaults position to top', () => {
    const { container } = render(
      <DataTableFilter filterId="f1" column="name">
        Filter
      </DataTableFilter>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-position', 'top');
  });

  it('applies custom className alongside base class', () => {
    const { container } = render(
      <DataTableFilter filterId="f1" column="name" className="custom">
        Filter
      </DataTableFilter>,
    );
    const div = container.firstElementChild!;
    expect(div.className).toBe('data-table-filter custom');
  });

  it('uses base class when no custom className is provided', () => {
    const { container } = render(
      <DataTableFilter filterId="f1" column="name">
        Filter
      </DataTableFilter>,
    );
    expect(container.firstElementChild!.className).toBe('data-table-filter');
  });
});

/* ── applyFilters ──────────────────────────────────────── */

interface Row {
  name: string;
  age: number;
  role: string;
}

const rows: Row[] = [
  { name: 'Alice', age: 30, role: 'admin' },
  { name: 'Bob', age: 25, role: 'user' },
  { name: 'Carol', age: 35, role: 'admin' },
];

function makeFilter(
  overrides: Partial<FilterConfig<Row>> & { column: string },
): FilterConfig<Row> {
  return {
    filterId: 'f',
    operator: 'equals',
    value: null,
    ...overrides,
  };
}

describe('applyFilters', () => {
  it('returns all rows when filters have null/undefined/empty values', () => {
    const filters: FilterConfig<Row>[] = [
      makeFilter({ column: 'name', value: null }),
      makeFilter({ column: 'name', value: undefined }),
      makeFilter({ column: 'name', value: '' }),
    ];
    expect(applyFilters(rows, filters)).toEqual(rows);
  });

  it('filters with equals operator', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'name', operator: 'equals', value: 'Alice' }),
    ]);
    expect(result).toEqual([rows[0]]);
  });

  it('filters with not-equals operator', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'name', operator: 'not-equals', value: 'Alice' }),
    ]);
    expect(result).toEqual([rows[1], rows[2]]);
  });

  it('filters with contains operator (case insensitive)', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'name', operator: 'contains', value: 'ali' }),
    ]);
    expect(result).toEqual([rows[0]]);
  });

  it('filters with gt operator', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'age', operator: 'gt', value: 30 }),
    ]);
    expect(result).toEqual([rows[2]]);
  });

  it('filters with lt operator', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'age', operator: 'lt', value: 30 }),
    ]);
    expect(result).toEqual([rows[1]]);
  });

  it('filters with gte operator', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'age', operator: 'gte', value: 30 }),
    ]);
    expect(result).toEqual([rows[0], rows[2]]);
  });

  it('filters with lte operator', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'age', operator: 'lte', value: 30 }),
    ]);
    expect(result).toEqual([rows[0], rows[1]]);
  });

  it('filters with in operator', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'role', operator: 'in', value: ['admin'] }),
    ]);
    expect(result).toEqual([rows[0], rows[2]]);
  });

  it('in operator returns no rows when value is not an array', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'role', operator: 'in', value: 'admin' }),
    ]);
    expect(result).toEqual([]);
  });

  it('custom operator delegates to filterFn', () => {
    const filterFn = vi.fn((row: Row) => row.age > 28);
    const result = applyFilters(rows, [
      makeFilter({
        column: 'age',
        operator: 'custom',
        value: true,
        filterFn,
      }),
    ]);
    expect(result).toEqual([rows[0], rows[2]]);
    expect(filterFn).toHaveBeenCalledTimes(3);
  });

  it('custom operator without filterFn keeps all rows', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'age', operator: 'custom', value: true }),
    ]);
    expect(result).toEqual(rows);
  });

  it('combines multiple filters with AND logic', () => {
    const result = applyFilters(rows, [
      makeFilter({ column: 'role', operator: 'equals', value: 'admin' }),
      makeFilter({ column: 'age', operator: 'gt', value: 31 }),
    ]);
    expect(result).toEqual([rows[2]]);
  });

  it('equals compares Date objects by time', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    const d3 = new Date('2024-06-01');
    const dateRows = [{ ts: d1 }, { ts: d3 }];
    const result = applyFilters(dateRows, [
      { filterId: 'f', column: 'ts', operator: 'equals', value: d2 },
    ]);
    expect(result).toEqual([{ ts: d1 }]);
  });

  it('gt operator works with Date objects', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-06-01');
    const dateRows = [{ ts: d1 }, { ts: d2 }];
    const result = applyFilters(dateRows, [
      {
        filterId: 'f',
        column: 'ts',
        operator: 'gt',
        value: new Date('2024-03-01'),
      },
    ]);
    expect(result).toEqual([{ ts: d2 }]);
  });
});
