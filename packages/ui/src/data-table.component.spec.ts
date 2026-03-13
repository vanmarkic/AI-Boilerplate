import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import type { SortState } from './data-table.types';

interface TestRow {
  id: number;
  name: string;
  price: number;
  category: string;
}

const TEST_DATA: TestRow[] = [
  { id: 1, name: 'Alpha', price: 30, category: 'A' },
  { id: 2, name: 'Beta', price: 10, category: 'B' },
  { id: 3, name: 'Gamma', price: 20, category: 'A' },
  { id: 4, name: 'Delta', price: 40, category: 'B' },
];

@Component({
  selector: 'ui-test-host',
  imports: [DataTableComponent, DataTableColumnComponent],
  template: `
    <ui-data-table
      [dataSource]="data()"
      [size]="size()"
      [striped]="striped()"
      [multiSort]="multiSort()"
      [defaultSort]="defaultSort()"
      [clickableRows]="clickableRows()"
      (sortChange)="lastSortEvent = $event"
      (rowClick)="lastRowClickEvent = $event"
    >
      <ui-data-table-column columnDef="id" label="ID" [sortable]="true" align="center" />
      <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
      <ui-data-table-column columnDef="price" label="Price" [sortable]="true" align="end" />
      <ui-data-table-column columnDef="category" label="Category" />
      <div emptyState>No data found.</div>
    </ui-data-table>
  `,
})
class TestHostComponent {
  readonly data = input<TestRow[]>(TEST_DATA);
  readonly size = input<'default' | 'compact'>('default');
  readonly striped = input(false);
  readonly multiSort = input(false);
  readonly defaultSort = input<SortState[]>([]);
  readonly clickableRows = input(false);
  lastSortEvent: SortState[] = [];
  lastRowClickEvent: TestRow | null = null;
}

function getHeaderCells(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.data-table-header-cell'));
}

function getBodyRows(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.data-table-row'));
}

function getCellsText(row: HTMLElement): string[] {
  const cells: HTMLElement[] = Array.from(row.querySelectorAll('.data-table-cell'));
  return cells.map((c) => c.textContent?.trim() ?? '');
}

function columnValues(el: HTMLElement, colIdx: number): string[] {
  return getBodyRows(el).map((r) => getCellsText(r)[colIdx]);
}

async function setup(
  overrides: Partial<{
    data: TestRow[];
    size: 'default' | 'compact';
    striped: boolean;
    multiSort: boolean;
    defaultSort: SortState[];
    clickableRows: boolean;
  }> = {},
): Promise<{ fixture: ComponentFixture<TestHostComponent>; el: HTMLElement }> {
  const fixture = TestBed.createComponent(TestHostComponent);
  if (overrides.data !== undefined) fixture.componentRef.setInput('data', overrides.data);
  if (overrides.size) fixture.componentRef.setInput('size', overrides.size);
  if (overrides.striped !== undefined) fixture.componentRef.setInput('striped', overrides.striped);
  if (overrides.multiSort !== undefined) fixture.componentRef.setInput('multiSort', overrides.multiSort);
  if (overrides.defaultSort) fixture.componentRef.setInput('defaultSort', overrides.defaultSort);
  if (overrides.clickableRows !== undefined) fixture.componentRef.setInput('clickableRows', overrides.clickableRows);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement };
}

function clickHeader(fixture: ComponentFixture<TestHostComponent>, index: number): void {
  getHeaderCells(fixture.nativeElement)[index].click();
  fixture.detectChanges();
}

describe('DataTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
  });

  describe('rendering', () => {
    it('should render the table with correct number of rows', async () => {
      const { el } = await setup();
      expect(getBodyRows(el).length).toBe(4);
    });

    it('should render header cells with labels', async () => {
      const { el } = await setup();
      const headers = getHeaderCells(el);
      expect(headers.length).toBe(4);
      expect(headers[0].textContent).toContain('ID');
      expect(headers[1].textContent).toContain('Name');
      expect(headers[2].textContent).toContain('Price');
      expect(headers[3].textContent).toContain('Category');
    });

    it('should render cell data correctly', async () => {
      const { el } = await setup();
      const firstRow = getCellsText(getBodyRows(el)[0]);
      expect(firstRow[0]).toBe('1');
      expect(firstRow[1]).toBe('Alpha');
      expect(firstRow[2]).toBe('30');
      expect(firstRow[3]).toBe('A');
    });

    it('should show empty state when dataSource is empty', async () => {
      const { el } = await setup({ data: [] });
      const emptyDiv = el.querySelector('.data-table-empty');
      expect(emptyDiv).toBeTruthy();
      expect(emptyDiv?.textContent?.trim()).toBe('No data found.');
    });

    it('should not show empty state when dataSource has items', async () => {
      const { el } = await setup();
      expect(el.querySelector('.data-table-empty')).toBeFalsy();
    });
  });

  describe('host bindings', () => {
    it('should have data-table class on host', async () => {
      const { el } = await setup();
      const host = el.querySelector('ui-data-table')!;
      expect(host.classList.contains('data-table')).toBe(true);
    });

    it('should set data-size=compact', async () => {
      const { el } = await setup({ size: 'compact' });
      expect(el.querySelector('ui-data-table')!.getAttribute('data-size')).toBe('compact');
    });

    it('should default data-size to default', async () => {
      const { el } = await setup();
      expect(el.querySelector('ui-data-table')!.getAttribute('data-size')).toBe('default');
    });

    it('should set data-striped=true', async () => {
      const { el } = await setup({ striped: true });
      expect(el.querySelector('ui-data-table')!.getAttribute('data-striped')).toBe('true');
    });
  });

  describe('sorting – single', () => {
    it('should sort ascending on first click', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 2);
      expect(columnValues(el, 2)).toEqual(['10', '20', '30', '40']);
    });

    it('should sort descending on second click', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 2);
      clickHeader(fixture, 2);
      expect(columnValues(el, 2)).toEqual(['40', '30', '20', '10']);
    });

    it('should clear sort on third click (back to original order)', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 2);
      clickHeader(fixture, 2);
      clickHeader(fixture, 2);
      expect(columnValues(el, 0)).toEqual(['1', '2', '3', '4']);
    });

    it('should emit sortChange on sort toggle', async () => {
      const { fixture } = await setup();
      clickHeader(fixture, 1);
      expect(fixture.componentInstance.lastSortEvent).toEqual([
        { column: 'name', direction: 'asc' },
      ]);
    });

    it('should replace sort when clicking different column', async () => {
      const { fixture } = await setup();
      clickHeader(fixture, 1);
      clickHeader(fixture, 2);
      expect(fixture.componentInstance.lastSortEvent).toEqual([
        { column: 'price', direction: 'asc' },
      ]);
    });

    it('should not sort on non-sortable column click', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 3);
      expect(columnValues(el, 0)).toEqual(['1', '2', '3', '4']);
      expect(fixture.componentInstance.lastSortEvent).toEqual([]);
    });
  });

  describe('sorting – multi', () => {
    it('should accumulate sorts when multiSort enabled', async () => {
      const { fixture } = await setup({ multiSort: true });
      clickHeader(fixture, 1);
      clickHeader(fixture, 2);
      expect(fixture.componentInstance.lastSortEvent).toEqual([
        { column: 'name', direction: 'asc' },
        { column: 'price', direction: 'asc' },
      ]);
    });

    it('should toggle direction for already sorted column', async () => {
      const { fixture } = await setup({ multiSort: true });
      clickHeader(fixture, 1);
      clickHeader(fixture, 2);
      clickHeader(fixture, 1);
      expect(fixture.componentInstance.lastSortEvent).toEqual([
        { column: 'name', direction: 'desc' },
        { column: 'price', direction: 'asc' },
      ]);
    });

    it('should remove sort on third click', async () => {
      const { fixture } = await setup({ multiSort: true });
      clickHeader(fixture, 1);
      clickHeader(fixture, 2);
      clickHeader(fixture, 1);
      clickHeader(fixture, 1);
      expect(fixture.componentInstance.lastSortEvent).toEqual([
        { column: 'price', direction: 'asc' },
      ]);
    });
  });

  describe('defaultSort', () => {
    it('should apply default sort on init', async () => {
      const { el } = await setup({
        defaultSort: [{ column: 'price', direction: 'desc' }],
      });
      expect(columnValues(el, 2)).toEqual(['40', '30', '20', '10']);
    });

    it('should apply multi default sort', async () => {
      const { el } = await setup({
        multiSort: true,
        defaultSort: [
          { column: 'category', direction: 'asc' },
          { column: 'price', direction: 'asc' },
        ],
      });
      const rows = getBodyRows(el).map((r) => {
        const cells = getCellsText(r);
        return { cat: cells[3], price: Number(cells[2]) };
      });
      expect(rows[0].cat).toBe('A');
      expect(rows[1].cat).toBe('A');
      expect(rows[0].price).toBeLessThan(rows[1].price);
      expect(rows[2].cat).toBe('B');
      expect(rows[3].cat).toBe('B');
      expect(rows[2].price).toBeLessThan(rows[3].price);
    });
  });

  describe('sort indicators', () => {
    it('should mark sortable headers with sortable class', async () => {
      const { el } = await setup();
      const headers = getHeaderCells(el);
      expect(headers[0].classList.contains('data-table-header-cell-sortable')).toBe(true);
      expect(headers[1].classList.contains('data-table-header-cell-sortable')).toBe(true);
      expect(headers[2].classList.contains('data-table-header-cell-sortable')).toBe(true);
      expect(headers[3].classList.contains('data-table-header-cell-sortable')).toBe(false);
    });

    it('should render sort icon only on sortable columns', async () => {
      const { el } = await setup();
      const headers = getHeaderCells(el);
      expect(headers[0].querySelector('.data-table-sort-icon')).toBeTruthy();
      expect(headers[3].querySelector('.data-table-sort-icon')).toBeFalsy();
    });

    it('should set data-active=true on active sort icon', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 1);
      const headers = getHeaderCells(el);
      expect(headers[1].querySelector('.data-table-sort-icon')?.getAttribute('data-active')).toBe('true');
      expect(headers[0].querySelector('.data-table-sort-icon')?.getAttribute('data-active')).toBe('false');
    });

    it('should set data-direction=desc when sorted desc', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 1);
      clickHeader(fixture, 1);
      const icon = getHeaderCells(el)[1].querySelector('.data-table-sort-icon');
      expect(icon?.getAttribute('data-direction')).toBe('desc');
    });

    it('should show sort priority badge in multi-sort with 2+ active sorts', async () => {
      const { fixture, el } = await setup({ multiSort: true });
      clickHeader(fixture, 0);
      clickHeader(fixture, 1);
      const headers = getHeaderCells(el);
      expect(headers[0].querySelector('.data-table-sort-badge')?.textContent?.trim()).toBe('1');
      expect(headers[1].querySelector('.data-table-sort-badge')?.textContent?.trim()).toBe('2');
    });

    it('should not show sort badge with single sort', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 1);
      expect(getHeaderCells(el)[1].querySelector('.data-table-sort-badge')).toBeFalsy();
    });
  });

  describe('alignment', () => {
    it('should set data-align on header cells', async () => {
      const { el } = await setup();
      const headers = getHeaderCells(el);
      expect(headers[0].getAttribute('data-align')).toBe('center');
      expect(headers[1].getAttribute('data-align')).toBe('start');
      expect(headers[2].getAttribute('data-align')).toBe('end');
    });

    it('should set data-align on body cells', async () => {
      const { el } = await setup();
      const cells: HTMLElement[] = Array.from(getBodyRows(el)[0].querySelectorAll('.data-table-cell'));
      expect(cells[0].getAttribute('data-align')).toBe('center');
      expect(cells[1].getAttribute('data-align')).toBe('start');
      expect(cells[2].getAttribute('data-align')).toBe('end');
    });
  });

  describe('data type sorting', () => {
    it('should sort strings alphabetically', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 1);
      expect(columnValues(el, 1)).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
    });

    it('should sort numbers numerically (not lexicographically)', async () => {
      const { fixture, el } = await setup();
      clickHeader(fixture, 2);
      expect(columnValues(el, 2)).toEqual(['10', '20', '30', '40']);
    });
  });

  describe('clickableRows', () => {
    it('should not set data-clickable on rows by default', async () => {
      const { el } = await setup();
      const rows = getBodyRows(el);
      expect(rows[0].getAttribute('data-clickable')).toBeNull();
    });

    it('should set data-clickable on rows when clickableRows is true', async () => {
      const { el } = await setup({ clickableRows: true });
      const rows = getBodyRows(el);
      rows.forEach((row) => {
        expect(row.getAttribute('data-clickable')).toBe('true');
      });
    });

    it('should set tabindex=0 on rows when clickableRows is true', async () => {
      const { el } = await setup({ clickableRows: true });
      const rows = getBodyRows(el);
      rows.forEach((row) => {
        expect(row.getAttribute('tabindex')).toBe('0');
      });
    });

    it('should not set tabindex on rows when clickableRows is false', async () => {
      const { el } = await setup({ clickableRows: false });
      const rows = getBodyRows(el);
      expect(rows[0].getAttribute('tabindex')).toBeNull();
    });

    it('should emit rowClick with row data when a row is clicked', async () => {
      const { fixture, el } = await setup({ clickableRows: true });
      getBodyRows(el)[0].click();
      fixture.detectChanges();
      expect(fixture.componentInstance.lastRowClickEvent).toEqual(TEST_DATA[0]);
    });

    it('should not emit rowClick when clickableRows is false', async () => {
      const { fixture, el } = await setup({ clickableRows: false });
      getBodyRows(el)[0].click();
      fixture.detectChanges();
      expect(fixture.componentInstance.lastRowClickEvent).toBeNull();
    });

    it('should emit rowClick with correct row on keyboard Enter', async () => {
      const { fixture, el } = await setup({ clickableRows: true });
      const row = getBodyRows(el)[1];
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.lastRowClickEvent).toEqual(TEST_DATA[1]);
    });
  });
});
