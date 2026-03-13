import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import { DataTableFilterComponent } from './data-table-filter.component';
import type { FilterOperator } from './data-table-filter.types';

interface DateRow {
  id: number;
  name: string;
  createdAt: Date;
}

const JAN = new Date('2025-01-15');
const FEB = new Date('2025-02-15');
const MAR = new Date('2025-03-15');
const APR = new Date('2025-04-15');
const MAY = new Date('2025-05-15');

const DATE_DATA: DateRow[] = [
  { id: 1, name: 'Alpha', createdAt: JAN },
  { id: 2, name: 'Beta', createdAt: FEB },
  { id: 3, name: 'Gamma', createdAt: MAR },
  { id: 4, name: 'Delta', createdAt: APR },
  { id: 5, name: 'Epsilon', createdAt: MAY },
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
  selector: 'ui-test-date-host',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-filter
        filterId="dateFilter"
        column="createdAt"
        [operator]="op()"
        [value]="filterValue()"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
      <ui-data-table-column columnDef="createdAt" label="Created" />
    </ui-data-table>
  `,
})
class DateHost {
  readonly data = signal<DateRow[]>(DATE_DATA);
  readonly op = signal<FilterOperator>('gte');
  readonly filterValue = signal<unknown>(null);
}

async function create(): Promise<{
  fixture: ComponentFixture<DateHost>;
  el: HTMLElement;
}> {
  const fixture = TestBed.createComponent(DateHost);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement };
}

function applyFilter(
  fixture: ComponentFixture<DateHost>,
  op: FilterOperator,
  value: unknown,
): void {
  fixture.componentInstance.op.set(op);
  fixture.componentInstance.filterValue.set(value);
  fixture.detectChanges();
}

describe('DataTableFilter — date filtering', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateHost],
    }).compileComponents();
  });

  describe('gte with dates', () => {
    it('should include rows with date >= filter date', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'gte', MAR);
      // MAR, APR, MAY
      expect(getBodyRows(el).length).toBe(3);
      expect(columnValues(el, 1)).toEqual(['Gamma', 'Delta', 'Epsilon']);
    });

    it('should include the exact date boundary', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'gte', new Date('2025-03-15'));
      expect(getBodyRows(el).length).toBe(3);
    });
  });

  describe('gt with dates', () => {
    it('should exclude exact match and include later dates', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'gt', MAR);
      // APR, MAY
      expect(getBodyRows(el).length).toBe(2);
      expect(columnValues(el, 1)).toEqual(['Delta', 'Epsilon']);
    });
  });

  describe('lt with dates', () => {
    it('should include rows with date < filter date', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'lt', MAR);
      // JAN, FEB
      expect(getBodyRows(el).length).toBe(2);
      expect(columnValues(el, 1)).toEqual(['Alpha', 'Beta']);
    });
  });

  describe('lte with dates', () => {
    it('should include rows with date <= filter date', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'lte', MAR);
      // JAN, FEB, MAR
      expect(getBodyRows(el).length).toBe(3);
      expect(columnValues(el, 1)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });
  });

  describe('equals with dates', () => {
    it('should match date by timestamp equality', async () => {
      const { fixture, el } = await create();
      // Different Date instance, same timestamp
      applyFilter(fixture, 'equals', new Date('2025-03-15'));
      expect(getBodyRows(el).length).toBe(1);
      expect(columnValues(el, 1)).toEqual(['Gamma']);
    });

    it('should not match different dates', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'equals', new Date('2025-06-01'));
      expect(getBodyRows(el).length).toBe(0);
    });
  });

  describe('not-equals with dates', () => {
    it('should exclude rows matching the date', async () => {
      const { fixture, el } = await create();
      applyFilter(fixture, 'not-equals', new Date('2025-03-15'));
      // All except Gamma
      expect(getBodyRows(el).length).toBe(4);
    });
  });

  describe('date range (gte + lte via two filters)', () => {
    it('should filter a date range', async () => {
      @Component({
        selector: 'ui-test-date-range',
        imports: [
          DataTableComponent,
          DataTableColumnComponent,
          DataTableFilterComponent,
        ],
        template: `
          <ui-data-table [dataSource]="data()">
            <ui-data-table-filter filterId="from" column="createdAt"
              operator="gte" [value]="from()" position="top" />
            <ui-data-table-filter filterId="to" column="createdAt"
              operator="lte" [value]="to()" position="top" />
            <ui-data-table-column columnDef="id" label="ID" />
            <ui-data-table-column columnDef="name" label="Name" />
          </ui-data-table>
        `,
      })
      class DateRangeHost {
        readonly data = signal<DateRow[]>(DATE_DATA);
        readonly from = signal<Date | null>(null);
        readonly to = signal<Date | null>(null);
      }

      TestBed.configureTestingModule({ imports: [DateRangeHost] });
      const fixture = TestBed.createComponent(DateRangeHost);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.from.set(FEB);
      fixture.componentInstance.to.set(APR);
      fixture.detectChanges();

      // FEB, MAR, APR
      expect(getBodyRows(fixture.nativeElement).length).toBe(3);
      expect(columnValues(fixture.nativeElement, 1)).toEqual([
        'Beta',
        'Gamma',
        'Delta',
      ]);
    });
  });
});
