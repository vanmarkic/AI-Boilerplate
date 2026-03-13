import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import { DataTableTreeFilterComponent } from './data-table-tree-filter.component';
import type { TreeFilterNode } from './data-table-tree-filter.types';

interface TestRow {
  id: number;
  name: string;
  category: string[];
}

const TREE: TreeFilterNode[] = [
  {
    value: 'Electronics',
    children: [
      {
        value: 'Phones',
        children: [{ value: 'iPhone' }, { value: 'Android' }],
      },
      {
        value: 'Laptops',
        children: [{ value: 'MacBook' }, { value: 'ThinkPad' }],
      },
    ],
  },
  {
    value: 'Clothing',
    children: [{ value: 'Shirts' }, { value: 'Pants' }],
  },
];

const TEST_DATA: TestRow[] = [
  { id: 1, name: 'iPhone 15', category: ['Electronics', 'Phones', 'iPhone'] },
  { id: 2, name: 'Galaxy S24', category: ['Electronics', 'Phones', 'Android'] },
  { id: 3, name: 'MacBook Pro', category: ['Electronics', 'Laptops', 'MacBook'] },
  { id: 4, name: 'ThinkPad X1', category: ['Electronics', 'Laptops', 'ThinkPad'] },
  { id: 5, name: 'Polo Shirt', category: ['Clothing', 'Shirts'] },
  { id: 6, name: 'Jeans', category: ['Clothing', 'Pants'] },
];

function getBodyRows(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.data-table-row'));
}

function getCellsText(row: HTMLElement): string[] {
  return Array.from(row.querySelectorAll('.data-table-cell')).map(
    (c) => c.textContent?.trim() ?? '',
  );
}

function getTreeNodes(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.tree-filter-node'));
}

function getToggle(node: HTMLElement): HTMLElement | null {
  return node.querySelector('.tree-filter-toggle');
}

function getCheckbox(node: HTMLElement): HTMLInputElement | null {
  return node.querySelector('input[type="checkbox"]');
}

@Component({
  selector: 'ui-test-tree-multi',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableTreeFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-tree-filter
        filterId="cat"
        column="category"
        [options]="tree"
        [multi]="true"
        position="left"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
    </ui-data-table>
  `,
})
class TreeMultiHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly tree = TREE;
}

async function create(): Promise<{
  fixture: ComponentFixture<TreeMultiHost>;
  el: HTMLElement;
}> {
  const fixture = TestBed.createComponent(TreeMultiHost);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement };
}

describe('DataTableTreeFilter — multi-select', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeMultiHost],
    }).compileComponents();
  });

  describe('multi selection', () => {
    it('should select multiple disjoint branches', async () => {
      const { fixture, el } = await create();
      // Expand Electronics, select Phones
      getToggle(getTreeNodes(el)[0])!.click();
      fixture.detectChanges();
      getCheckbox(getTreeNodes(el)[1])!.click(); // Phones
      fixture.detectChanges();

      // Also select Clothing
      getCheckbox(getTreeNodes(el)[3])!.click(); // Clothing (after Laptops at 2)
      fixture.detectChanges();

      // Phones: iPhone, Galaxy + Clothing: Polo, Jeans = 4
      expect(getBodyRows(el).length).toBe(4);
    });

    it('should deselect one branch and keep the other', async () => {
      const { fixture, el } = await create();
      // Select both top-level
      getCheckbox(getTreeNodes(el)[0])!.click(); // Electronics
      fixture.detectChanges();
      getCheckbox(getTreeNodes(el)[1])!.click(); // Clothing
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(6);

      // Deselect Electronics
      getCheckbox(getTreeNodes(el)[0])!.click();
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(2); // Only Clothing
    });

    it('should handle parent+child overlap without duplication', async () => {
      const { fixture, el } = await create();
      // Select Electronics (covers all 4)
      getCheckbox(getTreeNodes(el)[0])!.click();
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(4);

      // Expand and also select Phones (already covered by parent)
      getToggle(getTreeNodes(el)[0])!.click();
      fixture.detectChanges();
      getCheckbox(getTreeNodes(el)[1])!.click(); // Phones
      fixture.detectChanges();

      // Should still be 4 — no duplication
      expect(getBodyRows(el).length).toBe(4);
    });
  });

  describe('indeterminate state', () => {
    it('should show indeterminate on parent when some children selected', async () => {
      const { fixture, el } = await create();
      // Expand Electronics → expand Phones → select iPhone only
      getToggle(getTreeNodes(el)[0])!.click();
      fixture.detectChanges();
      getToggle(getTreeNodes(el)[1])!.click();
      fixture.detectChanges();
      getCheckbox(getTreeNodes(el)[2])!.click(); // iPhone
      fixture.detectChanges();

      // Phones parent should be indeterminate (iPhone selected, Android not)
      const phonesCheckbox = getCheckbox(getTreeNodes(el)[1])!;
      expect(phonesCheckbox.indeterminate).toBe(true);

      // Electronics parent should also be indeterminate
      const electronicsCheckbox = getCheckbox(getTreeNodes(el)[0])!;
      expect(electronicsCheckbox.indeterminate).toBe(true);
    });

    it('should show checked on parent when all children selected', async () => {
      const { fixture, el } = await create();
      getToggle(getTreeNodes(el)[0])!.click();
      fixture.detectChanges();
      getToggle(getTreeNodes(el)[1])!.click();
      fixture.detectChanges();

      // Select both iPhone and Android
      getCheckbox(getTreeNodes(el)[2])!.click(); // iPhone
      fixture.detectChanges();
      getCheckbox(getTreeNodes(el)[3])!.click(); // Android
      fixture.detectChanges();

      const phonesCheckbox = getCheckbox(getTreeNodes(el)[1])!;
      expect(phonesCheckbox.checked).toBe(true);
      expect(phonesCheckbox.indeterminate).toBe(false);
    });
  });

  describe('select parent toggles all children', () => {
    it('should select all descendants when parent checked', async () => {
      const { fixture, el } = await create();
      getToggle(getTreeNodes(el)[0])!.click(); // expand Electronics
      fixture.detectChanges();
      getToggle(getTreeNodes(el)[1])!.click(); // expand Phones
      fixture.detectChanges();

      // Click Phones parent — should select iPhone + Android
      getCheckbox(getTreeNodes(el)[1])!.click();
      fixture.detectChanges();

      expect(getCheckbox(getTreeNodes(el)[2])!.checked).toBe(true); // iPhone
      expect(getCheckbox(getTreeNodes(el)[3])!.checked).toBe(true); // Android
    });

    it('should deselect all descendants when parent unchecked', async () => {
      const { fixture, el } = await create();
      getToggle(getTreeNodes(el)[0])!.click();
      fixture.detectChanges();
      getToggle(getTreeNodes(el)[1])!.click();
      fixture.detectChanges();

      // Select Phones parent
      getCheckbox(getTreeNodes(el)[1])!.click();
      fixture.detectChanges();
      expect(getCheckbox(getTreeNodes(el)[2])!.checked).toBe(true);

      // Deselect Phones parent
      getCheckbox(getTreeNodes(el)[1])!.click();
      fixture.detectChanges();
      expect(getCheckbox(getTreeNodes(el)[2])!.checked).toBe(false);
      expect(getCheckbox(getTreeNodes(el)[3])!.checked).toBe(false);
    });
  });

  describe('filter unregister', () => {
    it('should show all rows when tree filter is destroyed', async () => {
      @Component({
        selector: 'ui-test-destroy-tree',
        imports: [DataTableComponent, DataTableColumnComponent, DataTableTreeFilterComponent],
        template: `
          <ui-data-table [dataSource]="data()">
            @if (show()) {
              <ui-data-table-tree-filter filterId="cat" column="category"
                [options]="tree" [multi]="true" position="left" />
            }
            <ui-data-table-column columnDef="id" label="ID" />
            <ui-data-table-column columnDef="name" label="Name" />
          </ui-data-table>
        `,
      })
      class DestroyTreeHost {
        data = signal<TestRow[]>(TEST_DATA);
        tree = TREE;
        show = signal(true);
      }

      TestBed.configureTestingModule({ imports: [DestroyTreeHost] });
      const fixture = TestBed.createComponent(DestroyTreeHost);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Select Clothing
      getCheckbox(getTreeNodes(fixture.nativeElement)[1])!.click();
      fixture.detectChanges();
      expect(getBodyRows(fixture.nativeElement).length).toBe(2);

      // Destroy filter
      fixture.componentInstance.show.set(false);
      fixture.detectChanges();
      expect(getBodyRows(fixture.nativeElement).length).toBe(6);
    });
  });
});
