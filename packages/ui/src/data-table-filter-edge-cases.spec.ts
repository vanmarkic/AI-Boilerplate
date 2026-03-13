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

/* ── Empty string / undefined value ──────────────────── */

@Component({
  selector: 'ui-test-inactive-values',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter
        filterId="f1"
        column="category"
        operator="equals"
        [value]="val()"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="category" label="Category" />
    </ui-data-table>
  `,
})
class InactiveValuesHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly val = signal<unknown>(null);
}

/* ── Dynamic logic switch ────────────────────────────── */

@Component({
  selector: 'ui-test-dynamic-logic',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()" [filterLogic]="logic()">
      <ui-data-table-filter filterId="cat" column="category" operator="equals"
        [value]="catVal()" position="top" />
      <ui-data-table-filter filterId="reg" column="region" operator="equals"
        [value]="regVal()" position="top" />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="category" label="Category" />
      <ui-data-table-column columnDef="region" label="Region" />
    </ui-data-table>
  `,
})
class DynamicLogicHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly logic = signal<FilterLogic>('and');
  readonly catVal = signal<unknown>(null);
  readonly regVal = signal<unknown>(null);
}

/* ── Dynamic master position swap ────────────────────── */

@Component({
  selector: 'ui-test-dynamic-master',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()" [masterFilterPosition]="masterPos()">
      <ui-data-table-filter filterId="cat" column="category" operator="equals"
        [value]="catVal()" position="top" />
      <ui-data-table-filter filterId="price" column="price" operator="gt"
        [value]="priceVal()" position="left" />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="price" label="Price" />
      <ui-data-table-column columnDef="category" label="Category" />
    </ui-data-table>
  `,
})
class DynamicMasterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly masterPos = signal<FilterPosition>('top');
  readonly catVal = signal<unknown>(null);
  readonly priceVal = signal<unknown>(null);
}

/* ── Conditional filter (destroy/unregister) ─────────── */

@Component({
  selector: 'ui-test-destroy-filter',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      @if (showFilter()) {
        <ui-data-table-filter filterId="cat" column="category" operator="equals"
          [value]="'A'" position="top" />
      }
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="category" label="Category" />
    </ui-data-table>
  `,
})
class DestroyFilterHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly showFilter = signal(true);
}

/* ── Empty dataSource ────────────────────────────────── */

@Component({
  selector: 'ui-test-empty-data',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter filterId="cat" column="category" operator="equals"
        [value]="'A'" position="top" />
      <ui-data-table-column columnDef="id" label="ID" />
      <div emptyState>No data.</div>
    </ui-data-table>
  `,
})
class EmptyDataHost {
  readonly data = signal<TestRow[]>([]);
}

/* ── 3-level cascade chain ───────────────────────────── */

@Component({
  selector: 'ui-test-deep-cascade',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter filterId="cat" column="category" operator="equals"
        [value]="catVal()" position="top" />
      <ui-data-table-filter filterId="reg" column="region" operator="equals"
        [value]="regVal()" position="top" dependsOn="cat" />
      <ui-data-table-filter filterId="price" column="price" operator="gt"
        [value]="priceVal()" position="top" dependsOn="reg" />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="price" label="Price" />
      <ui-data-table-column columnDef="category" label="Category" />
      <ui-data-table-column columnDef="region" label="Region" />
    </ui-data-table>
  `,
})
class DeepCascadeHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly catVal = signal<unknown>(null);
  readonly regVal = signal<unknown>(null);
  readonly priceVal = signal<unknown>(null);
}

/* ── Two filters on same column ──────────────────────── */

@Component({
  selector: 'ui-test-same-column',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter filterId="minPrice" column="price" operator="gte"
        [value]="minPrice()" position="top" />
      <ui-data-table-filter filterId="maxPrice" column="price" operator="lte"
        [value]="maxPrice()" position="top" />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="price" label="Price" />
    </ui-data-table>
  `,
})
class SameColumnHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly minPrice = signal<unknown>(null);
  readonly maxPrice = signal<unknown>(null);
}

/* ── Specs ────────────────────────────────────────────── */

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

describe('DataTableFilter — edge cases', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InactiveValuesHost, DynamicLogicHost, DynamicMasterHost,
        DestroyFilterHost, EmptyDataHost, DeepCascadeHost, SameColumnHost,
      ],
    }).compileComponents();
  });

  describe('inactive filter values', () => {
    it('should treat empty string as inactive (show all rows)', async () => {
      const { fixture, el } = await create(InactiveValuesHost);
      fixture.componentInstance.val.set('');
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(6);
    });

    it('should treat undefined as inactive (show all rows)', async () => {
      const { fixture, el } = await create(InactiveValuesHost);
      fixture.componentInstance.val.set(undefined);
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(6);
    });
  });

  describe('dynamic filterLogic switch', () => {
    it('should switch from AND to OR reactively', async () => {
      const { fixture, el } = await create(DynamicLogicHost);
      fixture.componentInstance.catVal.set('C');
      fixture.componentInstance.regVal.set('North');
      fixture.componentInstance.logic.set('and');
      fixture.detectChanges();

      // AND: cat=C AND region=North => 0 matches
      expect(getBodyRows(el).length).toBe(0);

      fixture.componentInstance.logic.set('or');
      fixture.detectChanges();

      // OR: cat=C(Zeta) OR region=North(Alpha,Delta) => 3
      expect(getBodyRows(el).length).toBe(3);
    });
  });

  describe('dynamic masterFilterPosition swap', () => {
    it('should re-evaluate when masterFilterPosition changes', async () => {
      const { fixture, el } = await create(DynamicMasterHost);
      fixture.componentInstance.catVal.set('A');
      fixture.componentInstance.priceVal.set(25);
      fixture.componentInstance.masterPos.set('top');
      fixture.detectChanges();

      // top-first: cat=A => Alpha(30),Gamma(20),Epsilon(50); price>25 => 2
      expect(getBodyRows(el).length).toBe(2);

      fixture.componentInstance.masterPos.set('left');
      fixture.detectChanges();

      // left-first: price>25 => Alpha(30),Delta(40),Epsilon(50); cat=A => 2
      expect(getBodyRows(el).length).toBe(2);
    });
  });

  describe('filter unregister on destroy', () => {
    it('should remove filter effect when component is destroyed', async () => {
      const { fixture, el } = await create(DestroyFilterHost);

      // Filter active: cat=A => 3 rows
      expect(getBodyRows(el).length).toBe(3);

      fixture.componentInstance.showFilter.set(false);
      fixture.detectChanges();

      // Filter removed => all 6 rows
      expect(getBodyRows(el).length).toBe(6);
    });

    it('should re-apply filter when component is re-created', async () => {
      const { fixture, el } = await create(DestroyFilterHost);
      expect(getBodyRows(el).length).toBe(3);

      fixture.componentInstance.showFilter.set(false);
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(6);

      fixture.componentInstance.showFilter.set(true);
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(3);
    });
  });

  describe('empty dataSource with active filter', () => {
    it('should show empty state when data is empty', async () => {
      const { el } = await create(EmptyDataHost);
      expect(getBodyRows(el).length).toBe(0);
      expect(el.querySelector('.data-table-empty')).toBeTruthy();
    });
  });

  describe('3-level cascade chain', () => {
    it('should apply A → B → C sequentially', async () => {
      const { fixture, el } = await create(DeepCascadeHost);
      fixture.componentInstance.catVal.set('A');
      fixture.componentInstance.regVal.set('South');
      fixture.componentInstance.priceVal.set(10);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // cat=A => Alpha(30,North),Gamma(20,South),Epsilon(50,East)
      // reg=South (from above) => Gamma(20,South)
      // price>10 (from above) => Gamma(20) passes
      expect(getBodyRows(el).length).toBe(1);
      expect(getCellsText(getBodyRows(el)[0])[1]).toBe('Gamma');
    });

    it('should handle middle filter inactive in cascade', async () => {
      const { fixture, el } = await create(DeepCascadeHost);
      fixture.componentInstance.catVal.set('A');
      // regVal is null (inactive)
      fixture.componentInstance.priceVal.set(25);
      fixture.detectChanges();

      // cat=A => Alpha(30),Gamma(20),Epsilon(50)
      // reg is inactive => passes through
      // price>25 => Alpha(30),Epsilon(50)
      expect(getBodyRows(el).length).toBe(2);
    });
  });

  describe('two filters on same column (range)', () => {
    it('should apply both filters as AND range', async () => {
      const { fixture, el } = await create(SameColumnHost);
      fixture.componentInstance.minPrice.set(20);
      fixture.componentInstance.maxPrice.set(40);
      fixture.detectChanges();

      // price >= 20 AND price <= 40 => rows in original order: 30, 20, 40
      expect(columnValues(el, 1)).toEqual(['30', '20', '40']);
    });

    it('should show no results for impossible range', async () => {
      const { fixture, el } = await create(SameColumnHost);
      fixture.componentInstance.minPrice.set(50);
      fixture.componentInstance.maxPrice.set(10);
      fixture.detectChanges();

      // price >= 50 AND price <= 10 => impossible
      expect(getBodyRows(el).length).toBe(0);
    });
  });

  describe('OR logic with single active filter', () => {
    it('should behave same as single filter when only one is active', async () => {
      const { fixture, el } = await create(DynamicLogicHost);
      fixture.componentInstance.logic.set('or');
      fixture.componentInstance.catVal.set('A');
      // regVal remains null
      fixture.detectChanges();

      // Only cat=A active in OR => same as single filter
      expect(getBodyRows(el).length).toBe(3);
    });
  });

  describe('OR preserves original order', () => {
    it('should return rows in original dataSource order', async () => {
      const { fixture, el } = await create(DynamicLogicHost);
      fixture.componentInstance.logic.set('or');
      fixture.componentInstance.catVal.set('C');
      fixture.componentInstance.regVal.set('North');
      fixture.detectChanges();

      // C: Zeta(id=6) | North: Alpha(id=1), Delta(id=4) => order: 1,4,6
      const ids = columnValues(el, 0);
      expect(ids).toEqual(['1', '4', '6']);
    });
  });

  describe('rendering — conditional containers', () => {
    it('should not render left container when only top filters exist', async () => {
      const { el } = await create(InactiveValuesHost);
      expect(el.querySelector('.data-table-filters-top')).toBeTruthy();
      expect(el.querySelector('.data-table-filters-left')).toBeFalsy();
    });

    it('should render filter host with data-position attribute', async () => {
      const { el } = await create(InactiveValuesHost);
      const filter = el.querySelector('ui-data-table-filter');
      expect(filter?.getAttribute('data-position')).toBe('top');
    });

    it('should render filter host with data-filter-id attribute', async () => {
      const { el } = await create(InactiveValuesHost);
      const filter = el.querySelector('ui-data-table-filter');
      expect(filter?.getAttribute('data-filter-id')).toBe('f1');
    });
  });
});
