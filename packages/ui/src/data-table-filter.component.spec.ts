import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import { DataTableFilterComponent } from './data-table-filter.component';
import type { FilterLogic, FilterPosition } from './data-table-filter.types';

interface TestRow {
  id: number;
  name: string;
  price: number;
  category: string;
  region: string;
}

const TEST_DATA: TestRow[] = [
  { id: 1, name: 'Alpha', price: 30, category: 'A', region: 'North' },
  { id: 2, name: 'Beta', price: 10, category: 'B', region: 'South' },
  { id: 3, name: 'Gamma', price: 20, category: 'A', region: 'South' },
  { id: 4, name: 'Delta', price: 40, category: 'B', region: 'North' },
  { id: 5, name: 'Epsilon', price: 50, category: 'A', region: 'East' },
  { id: 6, name: 'Zeta', price: 15, category: 'C', region: 'East' },
];

/* ────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────── */

function getBodyRows(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.data-table-row'));
}

function getCellsText(row: HTMLElement): string[] {
  return Array.from(row.querySelectorAll('.data-table-cell')).map(
    (c) => c.textContent?.trim() ?? '',
  );
}

function columnValues(el: HTMLElement, colIdx: number): string[] {
  return getBodyRows(el).map((r) => getCellsText(r)[colIdx]);
}

/* ────────────────────────────────────────────────────────
 * Test Host — Single filter
 * ──────────────────────────────────────────────────────── */

@Component({
  selector: 'ui-test-single-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()" [filterLogic]="filterLogic()">
      <ui-data-table-filter
        filterId="cat"
        column="category"
        operator="equals"
        [value]="catValue()"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="price" label="Price" />
      <ui-data-table-column columnDef="category" label="Category" />
      <ui-data-table-column columnDef="region" label="Region" />
    </ui-data-table>
  `,
})
class SingleFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly catValue = signal<unknown>(null);
  readonly filterLogic = signal<FilterLogic>('and');
}

/* ────────────────────────────────────────────────────────
 * Test Host — Multiple filters with AND/OR
 * ──────────────────────────────────────────────────────── */

@Component({
  selector: 'ui-test-multi-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()" [filterLogic]="filterLogic()">
      <ui-data-table-filter
        filterId="cat"
        column="category"
        operator="equals"
        [value]="catValue()"
        position="top"
      />
      <ui-data-table-filter
        filterId="region"
        column="region"
        operator="equals"
        [value]="regionValue()"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="category" label="Category" />
      <ui-data-table-column columnDef="region" label="Region" />
    </ui-data-table>
  `,
})
class MultiFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly catValue = signal<unknown>(null);
  readonly regionValue = signal<unknown>(null);
  readonly filterLogic = signal<FilterLogic>('and');
}

/* ────────────────────────────────────────────────────────
 * Test Host — Cascading filters
 * ──────────────────────────────────────────────────────── */

@Component({
  selector: 'ui-test-cascade-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()" [filterLogic]="'and'">
      <ui-data-table-filter
        filterId="cat"
        column="category"
        operator="equals"
        [value]="catValue()"
        position="top"
      />
      <ui-data-table-filter
        filterId="region"
        column="region"
        operator="equals"
        [value]="regionValue()"
        position="top"
        dependsOn="cat"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="category" label="Category" />
      <ui-data-table-column columnDef="region" label="Region" />
    </ui-data-table>
  `,
})
class CascadeFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly catValue = signal<unknown>(null);
  readonly regionValue = signal<unknown>(null);
}

/* ────────────────────────────────────────────────────────
 * Test Host — Top + Left positions with master
 * ──────────────────────────────────────────────────────── */

@Component({
  selector: 'ui-test-position-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table
      [dataSource]="data()"
      [filterLogic]="'and'"
      [masterFilterPosition]="masterPos()"
    >
      <ui-data-table-filter
        filterId="cat"
        column="category"
        operator="equals"
        [value]="catValue()"
        position="top"
      />
      <ui-data-table-filter
        filterId="price"
        column="price"
        operator="gt"
        [value]="priceValue()"
        position="left"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="price" label="Price" />
      <ui-data-table-column columnDef="category" label="Category" />
    </ui-data-table>
  `,
})
class PositionFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly catValue = signal<unknown>(null);
  readonly priceValue = signal<unknown>(null);
  readonly masterPos = signal<FilterPosition>('top');
}

/* ────────────────────────────────────────────────────────
 * Test Host — Custom filter function
 * ──────────────────────────────────────────────────────── */

@Component({
  selector: 'ui-test-custom-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter
        filterId="custom"
        column="name"
        operator="custom"
        [value]="searchValue()"
        [filterFn]="nameStartsWith"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
    </ui-data-table>
  `,
})
class CustomFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly searchValue = signal<unknown>(null);
  readonly nameStartsWith = (row: Record<string, unknown>, value: unknown): boolean =>
    String(row['name']).toLowerCase().startsWith(String(value).toLowerCase());
}

/* ────────────────────────────────────────────────────────
 * Test Host — Contains operator
 * ──────────────────────────────────────────────────────── */

@Component({
  selector: 'ui-test-contains-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter
        filterId="search"
        column="name"
        operator="contains"
        [value]="searchValue()"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
    </ui-data-table>
  `,
})
class ContainsFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly searchValue = signal<unknown>(null);
}

/* ────────────────────────────────────────────────────────
 * Test Host — 'in' operator (multi-value)
 * ──────────────────────────────────────────────────────── */

@Component({
  selector: 'ui-test-in-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter
        filterId="cats"
        column="category"
        operator="in"
        [value]="catValues()"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="category" label="Category" />
    </ui-data-table>
  `,
})
class InFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly catValues = signal<unknown>(null);
}

/* ────────────────────────────────────────────────────────
 * Specs
 * ──────────────────────────────────────────────────────── */

async function create<T>(host: new () => T): Promise<{
  fixture: ComponentFixture<T>;
  el: HTMLElement;
}> {
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement };
}

describe('DataTableFilterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SingleFilterHost,
        MultiFilterHost,
        CascadeFilterHost,
        PositionFilterHost,
        CustomFilterHost,
        ContainsFilterHost,
        InFilterHost,
      ],
    }).compileComponents();
  });

  describe('filter must require parent table', () => {
    it('should throw when used outside a ui-data-table', () => {
      @Component({
        selector: 'ui-test-orphan',
        imports: [DataTableFilterComponent],
        template: `
          <ui-data-table-filter
            filterId="orphan"
            column="x"
            operator="equals"
            [value]="null"
            position="top"
          />
        `,
      })
      class OrphanHost {}

      TestBed.configureTestingModule({ imports: [OrphanHost] });
      expect(() => {
        const f = TestBed.createComponent(OrphanHost);
        f.detectChanges();
      }).toThrow();
    });
  });

  describe('single filter — equals', () => {
    it('should show all rows when filter value is null', async () => {
      const { el } = await create(SingleFilterHost);
      expect(getBodyRows(el).length).toBe(6);
    });

    it('should filter rows by exact match', async () => {
      const { fixture, el } = await create(SingleFilterHost);
      fixture.componentInstance.catValue.set('A');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const cats = columnValues(el, 3);
      expect(cats.every((c) => c === 'A')).toBe(true);
      expect(getBodyRows(el).length).toBe(3);
    });

    it('should update when filter value changes', async () => {
      const { fixture, el } = await create(SingleFilterHost);
      fixture.componentInstance.catValue.set('A');
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(3);

      fixture.componentInstance.catValue.set('B');
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(2);
      expect(columnValues(el, 3).every((c) => c === 'B')).toBe(true);
    });

    it('should show all rows when filter is cleared', async () => {
      const { fixture, el } = await create(SingleFilterHost);
      fixture.componentInstance.catValue.set('A');
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(3);

      fixture.componentInstance.catValue.set(null);
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(6);
    });
  });

  describe('multiple filters — AND logic', () => {
    it('should apply all filters with AND when filterLogic is and', async () => {
      const { fixture, el } = await create(MultiFilterHost);
      fixture.componentInstance.catValue.set('A');
      fixture.componentInstance.regionValue.set('South');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Only Gamma: category=A, region=South
      expect(getBodyRows(el).length).toBe(1);
      expect(getCellsText(getBodyRows(el)[0])[1]).toBe('Gamma');
    });

    it('should intersect results when multiple AND filters active', async () => {
      const { fixture, el } = await create(MultiFilterHost);
      fixture.componentInstance.filterLogic.set('and');
      fixture.componentInstance.catValue.set('B');
      fixture.componentInstance.regionValue.set('North');
      fixture.detectChanges();

      // Only Delta: category=B, region=North
      expect(getBodyRows(el).length).toBe(1);
      expect(getCellsText(getBodyRows(el)[0])[1]).toBe('Delta');
    });
  });

  describe('multiple filters — OR logic', () => {
    it('should apply filters with OR when filterLogic is or', async () => {
      const { fixture, el } = await create(MultiFilterHost);
      fixture.componentInstance.filterLogic.set('or');
      fixture.componentInstance.catValue.set('C');
      fixture.componentInstance.regionValue.set('North');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // C: Zeta | North: Alpha, Delta => Zeta, Alpha, Delta (3 unique)
      expect(getBodyRows(el).length).toBe(3);
    });

    it('should show union of matched rows', async () => {
      const { fixture, el } = await create(MultiFilterHost);
      fixture.componentInstance.filterLogic.set('or');
      fixture.componentInstance.catValue.set('A');
      fixture.componentInstance.regionValue.set('South');
      fixture.detectChanges();

      // A: Alpha,Gamma,Epsilon | South: Beta,Gamma => Alpha,Beta,Gamma,Epsilon (4 unique)
      expect(getBodyRows(el).length).toBe(4);
    });
  });

  describe('cascading filters', () => {
    it('should apply dependent filter on parent output only', async () => {
      const { fixture, el } = await create(CascadeFilterHost);
      fixture.componentInstance.catValue.set('A');
      fixture.componentInstance.regionValue.set('South');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // cat=A => Alpha,Gamma,Epsilon; then region=South from that => Gamma
      expect(getBodyRows(el).length).toBe(1);
      expect(getCellsText(getBodyRows(el)[0])[1]).toBe('Gamma');
    });

    it('should skip cascade when parent filter has no value', async () => {
      const { fixture, el } = await create(CascadeFilterHost);
      fixture.componentInstance.regionValue.set('South');
      fixture.detectChanges();

      // cat has no value => all data; region=South => Beta, Gamma
      expect(getBodyRows(el).length).toBe(2);
    });
  });

  describe('master filter position', () => {
    it('should apply top filters first when masterFilterPosition=top', async () => {
      const { fixture, el } = await create(PositionFilterHost);
      fixture.componentInstance.masterPos.set('top');
      fixture.componentInstance.catValue.set('A');
      fixture.componentInstance.priceValue.set(25);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // top master (cat=A) => Alpha(30),Gamma(20),Epsilon(50)
      // then left (price>25) => Alpha(30),Epsilon(50)
      expect(getBodyRows(el).length).toBe(2);
    });

    it('should apply left filters first when masterFilterPosition=left', async () => {
      const { fixture, el } = await create(PositionFilterHost);
      fixture.componentInstance.masterPos.set('left');
      fixture.componentInstance.catValue.set('A');
      fixture.componentInstance.priceValue.set(25);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // left master (price>25) => Alpha(30),Delta(40),Epsilon(50)
      // then top (cat=A) => Alpha(30),Epsilon(50)
      expect(getBodyRows(el).length).toBe(2);
    });

    it('should only apply master group when secondary has no active filters', async () => {
      const { fixture, el } = await create(PositionFilterHost);
      fixture.componentInstance.masterPos.set('top');
      fixture.componentInstance.catValue.set('B');
      fixture.detectChanges();

      // top master (cat=B) => Beta,Delta; left has no value => pass through
      expect(getBodyRows(el).length).toBe(2);
    });
  });

  describe('operators', () => {
    it('should support contains operator', async () => {
      const { fixture, el } = await create(ContainsFilterHost);
      fixture.componentInstance.searchValue.set('eta');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Beta, Zeta contain 'eta'
      expect(getBodyRows(el).length).toBe(2);
    });

    it('should support in operator for multi-value filtering', async () => {
      const { fixture, el } = await create(InFilterHost);
      fixture.componentInstance.catValues.set(['A', 'C']);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // A: Alpha,Gamma,Epsilon; C: Zeta => 4
      expect(getBodyRows(el).length).toBe(4);
    });

    it('should support custom filter function', async () => {
      const { fixture, el } = await create(CustomFilterHost);
      fixture.componentInstance.searchValue.set('al');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Alpha starts with 'al'
      expect(getBodyRows(el).length).toBe(1);
      expect(getCellsText(getBodyRows(el)[0])[1]).toBe('Alpha');
    });
  });

  describe('filter rendering', () => {
    it('should render top filters in a horizontal bar', async () => {
      const { el } = await create(SingleFilterHost);
      const topBar = el.querySelector('.data-table-filters-top');
      expect(topBar).toBeTruthy();
    });

    it('should render left filters in a vertical sidebar', async () => {
      const { el } = await create(PositionFilterHost);
      const leftBar = el.querySelector('.data-table-filters-left');
      expect(leftBar).toBeTruthy();
    });
  });

  describe('filter with sorting integration', () => {
    it('should filter before sorting', async () => {
      @Component({
        selector: 'ui-test-filter-sort',
        imports: [
          DataTableComponent,
          DataTableColumnComponent,
          DataTableFilterComponent,
        ],
        template: `
          <ui-data-table
            [dataSource]="data()"
            [defaultSort]="[{ column: 'price', direction: 'asc' }]"
          >
            <ui-data-table-filter
              filterId="cat"
              column="category"
              operator="equals"
              [value]="'A'"
              position="top"
            />
            <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
            <ui-data-table-column columnDef="price" label="Price" [sortable]="true" />
            <ui-data-table-column columnDef="category" label="Category" />
          </ui-data-table>
        `,
      })
      class FilterSortHost {
        readonly data = signal<TestRow[]>(TEST_DATA);
      }

      TestBed.configureTestingModule({ imports: [FilterSortHost] });
      const fixture = TestBed.createComponent(FilterSortHost);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // cat=A => Alpha(30), Gamma(20), Epsilon(50), sorted by price asc => 20, 30, 50
      const prices = columnValues(fixture.nativeElement, 1);
      expect(prices).toEqual(['20', '30', '50']);
    });
  });
});
