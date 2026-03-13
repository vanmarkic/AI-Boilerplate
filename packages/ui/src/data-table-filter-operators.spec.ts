import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import { DataTableFilterComponent } from './data-table-filter.component';
import type { FilterOperator } from './data-table-filter.types';

interface TestRow {
  id: number;
  name: string;
  price: number;
  category: string | null;
}

const TEST_DATA: TestRow[] = [
  { id: 1, name: 'Alpha', price: 10, category: 'A' },
  { id: 2, name: 'Beta', price: 20, category: 'B' },
  { id: 3, name: 'Gamma', price: 30, category: 'A' },
  { id: 4, name: 'Delta', price: 40, category: null },
  { id: 5, name: 'Epsilon', price: 50, category: 'C' },
];

function getBodyRows(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.data-table-row'));
}

function columnValues(el: HTMLElement, colIdx: number): string[] {
  return getBodyRows(el).map((r) => {
    const cells = Array.from(r.querySelectorAll('.data-table-cell'));
    return cells[colIdx]?.textContent?.trim() ?? '';
  });
}

@Component({
  selector: 'ui-test-op-host',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter
        filterId="f1"
        [column]="column()"
        [operator]="op()"
        [value]="filterValue()"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="price" label="Price" />
      <ui-data-table-column columnDef="category" label="Category" />
    </ui-data-table>
  `,
})
class OperatorHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly column = signal('price');
  readonly op = signal<FilterOperator>('equals');
  readonly filterValue = signal<unknown>(null);
}

async function create(): Promise<{
  fixture: ComponentFixture<OperatorHost>;
  el: HTMLElement;
}> {
  const fixture = TestBed.createComponent(OperatorHost);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement };
}

function applyFilter(
  fixture: ComponentFixture<OperatorHost>,
  col: string,
  op: FilterOperator,
  value: unknown,
): void {
  fixture.componentInstance.column.set(col);
  fixture.componentInstance.op.set(op);
  fixture.componentInstance.filterValue.set(value);
  fixture.detectChanges();
}

describe('DataTableFilter — operators', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorHost],
    }).compileComponents();
  });

  describe('not-equals', () => {
    it('should exclude rows matching the value', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'category', 'not-equals', 'A');
      // Excludes Alpha(A), Gamma(A) => Beta(B), Delta(null), Epsilon(C)
      expect(getBodyRows(el).length).toBe(3);
      expect(columnValues(el, 3)).toEqual(['B', '', 'C']);
    });
  });

  describe('gt', () => {
    it('should include rows where cell > value', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'price', 'gt', 30);
      expect(columnValues(el, 2)).toEqual(['40', '50']);
    });

    it('should exclude rows equal to value', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'price', 'gt', 30);
      expect(columnValues(el, 2)).not.toContain('30');
    });
  });

  describe('lt', () => {
    it('should include rows where cell < value', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'price', 'lt', 30);
      expect(columnValues(el, 2)).toEqual(['10', '20']);
    });
  });

  describe('gte', () => {
    it('should include rows where cell >= value', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'price', 'gte', 30);
      expect(columnValues(el, 2)).toEqual(['30', '40', '50']);
    });
  });

  describe('lte', () => {
    it('should include rows where cell <= value', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'price', 'lte', 30);
      expect(columnValues(el, 2)).toEqual(['10', '20', '30']);
    });
  });

  describe('contains — case insensitivity', () => {
    it('should match case-insensitively', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'name', 'contains', 'ALPHA');
      expect(getBodyRows(el).length).toBe(1);
      expect(columnValues(el, 1)).toEqual(['Alpha']);
    });

    it('should match partial substring', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'name', 'contains', 'a');
      // case-insensitive: Alpha, Beta(betA), Gamma, Delta all contain 'a'
      expect(columnValues(el, 1)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    });
  });

  describe('in — edge cases', () => {
    it('should return no rows for empty array', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'category', 'in', []);
      expect(getBodyRows(el).length).toBe(0);
    });

    it('should match single-element array', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'category', 'in', ['B']);
      expect(getBodyRows(el).length).toBe(1);
      expect(columnValues(el, 1)).toEqual(['Beta']);
    });
  });

  describe('null / undefined cell values', () => {
    it('should exclude null cells for equals operator', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'category', 'equals', 'A');
      // Only Alpha, Gamma (Delta has null)
      expect(getBodyRows(el).length).toBe(2);
    });

    it('should include null cells for not-equals operator', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'category', 'not-equals', 'A');
      // Beta(B), Delta(null), Epsilon(C)
      expect(getBodyRows(el).length).toBe(3);
    });
  });
});
