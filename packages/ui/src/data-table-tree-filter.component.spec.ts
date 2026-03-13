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

function getRadio(node: HTMLElement): HTMLInputElement | null {
  return node.querySelector('input[type="radio"]');
}

/* ── Multi-select host ───────────────────────────────── */

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

/* ── Single-select host ──────────────────────────────── */

@Component({
  selector: 'ui-test-tree-single',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableTreeFilterComponent],
  template: `
    <ui-data-table [dataSource]="data()">
      <ui-data-table-tree-filter
        filterId="cat"
        column="category"
        [options]="tree"
        [multi]="false"
        position="left"
      />
      <ui-data-table-column columnDef="id" label="ID" />
      <ui-data-table-column columnDef="name" label="Name" />
    </ui-data-table>
  `,
})
class TreeSingleHost {
  readonly data = signal<TestRow[]>(TEST_DATA);
  readonly tree = TREE;
}

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

describe('DataTableTreeFilterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeMultiHost, TreeSingleHost],
    }).compileComponents();
  });

  describe('must require parent table', () => {
    it('should throw when used outside a ui-data-table', () => {
      @Component({
        selector: 'ui-test-orphan-tree',
        imports: [DataTableTreeFilterComponent],
        template: `
          <ui-data-table-tree-filter filterId="x" column="c"
            [options]="[]" position="top" />
        `,
      })
      class OrphanTreeHost {}

      TestBed.configureTestingModule({ imports: [OrphanTreeHost] });
      expect(() => {
        const f = TestBed.createComponent(OrphanTreeHost);
        f.detectChanges();
      }).toThrow();
    });
  });

  describe('rendering', () => {
    it('should render top-level nodes by default', async () => {
      const { el } = await create(TreeMultiHost);
      const nodes = getTreeNodes(el);
      // Only top-level: Electronics, Clothing (children collapsed)
      expect(nodes.length).toBe(2);
      expect(nodes[0].textContent).toContain('Electronics');
      expect(nodes[1].textContent).toContain('Clothing');
    });

    it('should show expand toggle on parent nodes', async () => {
      const { el } = await create(TreeMultiHost);
      const nodes = getTreeNodes(el);
      expect(getToggle(nodes[0])).toBeTruthy();
      expect(getToggle(nodes[1])).toBeTruthy();
    });

    it('should expand children when toggle clicked', async () => {
      const { fixture, el } = await create(TreeMultiHost);
      const toggle = getToggle(getTreeNodes(el)[0])!;
      toggle.click();
      fixture.detectChanges();

      const nodes = getTreeNodes(el);
      // Electronics expanded: Electronics, Phones, Laptops + Clothing
      expect(nodes.length).toBe(4);
      expect(nodes[1].textContent).toContain('Phones');
      expect(nodes[2].textContent).toContain('Laptops');
    });

    it('should collapse when toggle clicked again', async () => {
      const { fixture, el } = await create(TreeMultiHost);
      const toggle = getToggle(getTreeNodes(el)[0])!;
      toggle.click();
      fixture.detectChanges();
      expect(getTreeNodes(el).length).toBe(4);

      toggle.click();
      fixture.detectChanges();
      expect(getTreeNodes(el).length).toBe(2);
    });

    it('should render checkboxes in multi mode', async () => {
      const { el } = await create(TreeMultiHost);
      const nodes = getTreeNodes(el);
      expect(getCheckbox(nodes[0])).toBeTruthy();
      expect(getRadio(nodes[0])).toBeFalsy();
    });

    it('should render radios in single mode', async () => {
      const { el } = await create(TreeSingleHost);
      const nodes = getTreeNodes(el);
      expect(getRadio(nodes[0])).toBeTruthy();
      expect(getCheckbox(nodes[0])).toBeFalsy();
    });
  });

  describe('no selection', () => {
    it('should show all rows when nothing is selected', async () => {
      const { el } = await create(TreeMultiHost);
      expect(getBodyRows(el).length).toBe(6);
    });
  });

  describe('single select — filtering', () => {
    it('should filter by top-level node (all descendants)', async () => {
      const { fixture, el } = await create(TreeSingleHost);
      const radio = getRadio(getTreeNodes(el)[1])!; // Clothing
      radio.click();
      fixture.detectChanges();

      expect(getBodyRows(el).length).toBe(2);
      expect(getCellsText(getBodyRows(el)[0])[1]).toBe('Polo Shirt');
      expect(getCellsText(getBodyRows(el)[1])[1]).toBe('Jeans');
    });

    it('should filter by leaf node', async () => {
      const { fixture, el } = await create(TreeSingleHost);
      // Expand Electronics → Phones → click iPhone
      getToggle(getTreeNodes(el)[0])!.click(); // expand Electronics
      fixture.detectChanges();
      getToggle(getTreeNodes(el)[1])!.click(); // expand Phones
      fixture.detectChanges();
      getRadio(getTreeNodes(el)[2])!.click(); // select iPhone
      fixture.detectChanges();

      expect(getBodyRows(el).length).toBe(1);
      expect(getCellsText(getBodyRows(el)[0])[1]).toBe('iPhone 15');
    });

    it('should filter by mid-level node', async () => {
      const { fixture, el } = await create(TreeSingleHost);
      getToggle(getTreeNodes(el)[0])!.click(); // expand Electronics
      fixture.detectChanges();
      getRadio(getTreeNodes(el)[2])!.click(); // select Laptops
      fixture.detectChanges();

      expect(getBodyRows(el).length).toBe(2);
      const names = getBodyRows(el).map((r) => getCellsText(r)[1]);
      expect(names).toEqual(['MacBook Pro', 'ThinkPad X1']);
    });

    it('should replace previous selection', async () => {
      const { fixture, el } = await create(TreeSingleHost);
      getRadio(getTreeNodes(el)[0])!.click(); // Electronics (6 match? no, 4)
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(4);

      getRadio(getTreeNodes(el)[1])!.click(); // Clothing
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(2);
    });

    it('should deselect when clicking selected node again', async () => {
      const { fixture, el } = await create(TreeSingleHost);
      getRadio(getTreeNodes(el)[1])!.click(); // Clothing
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(2);

      getRadio(getTreeNodes(el)[1])!.click(); // deselect
      fixture.detectChanges();
      expect(getBodyRows(el).length).toBe(6);
    });
  });
});
