import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import { DataTableTreeFilterComponent } from './data-table-tree-filter.component';
import type { TreeFilterNode } from './data-table-tree-filter.types';

// ── External data format (e.g. from an API or AG Grid-style flat rows) ──

interface ExternalProduct {
  id: number;
  name: string;
  department: string;
  subcategory: string;
  brand: string;
  price: number;
}

const EXTERNAL_DATA: ExternalProduct[] = [
  { id: 1, name: 'iPhone 15', department: 'Electronics', subcategory: 'Phones', brand: 'Apple', price: 999 },
  { id: 2, name: 'Galaxy S24', department: 'Electronics', subcategory: 'Phones', brand: 'Samsung', price: 849 },
  { id: 3, name: 'MacBook Pro', department: 'Electronics', subcategory: 'Laptops', brand: 'Apple', price: 2499 },
  { id: 4, name: 'ThinkPad X1', department: 'Electronics', subcategory: 'Laptops', brand: 'Lenovo', price: 1599 },
  { id: 5, name: 'AirPods Max', department: 'Electronics', subcategory: 'Audio', brand: 'Apple', price: 549 },
  { id: 6, name: 'Polo Shirt', department: 'Clothing', subcategory: 'Shirts', brand: 'Ralph Lauren', price: 89 },
  { id: 7, name: 'Slim Jeans', department: 'Clothing', subcategory: 'Pants', brand: 'Levi\'s', price: 69 },
  { id: 8, name: 'Running Shoes', department: 'Clothing', subcategory: 'Footwear', brand: 'Nike', price: 129 },
  { id: 9, name: 'The Hobbit', department: 'Books', subcategory: 'Fiction', brand: 'HarperCollins', price: 14 },
  { id: 10, name: 'Clean Code', department: 'Books', subcategory: 'Technical', brand: 'Prentice Hall', price: 39 },
];

// ── Adapter: transform flat rows into our path-based internal format ──

interface InternalProduct {
  id: number;
  name: string;
  category: string[];
  price: number;
}

function adaptProducts(rows: ExternalProduct[]): InternalProduct[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: [r.department, r.subcategory, r.brand],
    price: r.price,
  }));
}

function buildTree(rows: ExternalProduct[]): TreeFilterNode[] {
  const tree = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    if (!tree.has(row.department)) tree.set(row.department, new Map());
    const sub = tree.get(row.department)!;
    if (!sub.has(row.subcategory)) sub.set(row.subcategory, new Set());
    sub.get(row.subcategory)!.add(row.brand);
  }
  const result: TreeFilterNode[] = [];
  for (const [dept, subs] of tree) {
    const children: TreeFilterNode[] = [];
    for (const [sub, brands] of subs) {
      children.push({
        value: sub,
        children: [...brands].map((b) => ({ value: b })),
      });
    }
    result.push({ value: dept, children });
  }
  return result;
}

// ── Story host: single-select tree filter ──

@Component({
  selector: 'ui-tree-filter-single-story',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableTreeFilterComponent],
  template: `
    <ui-data-table [dataSource]="data">
      <ui-data-table-tree-filter
        filterId="category"
        column="category"
        [options]="tree"
        position="left"
      />
      <ui-data-table-column columnDef="id" label="ID" align="center" />
      <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
      <ui-data-table-column columnDef="price" label="Price" [sortable]="true" align="end" />
      <div emptyState>No products match the selection.</div>
    </ui-data-table>
  `,
})
class SingleSelectHost {
  readonly tree = buildTree(EXTERNAL_DATA);
  readonly data = adaptProducts(EXTERNAL_DATA);
}

// ── Story host: multi-select tree filter ──

@Component({
  selector: 'ui-tree-filter-multi-story',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableTreeFilterComponent],
  template: `
    <ui-data-table [dataSource]="data">
      <ui-data-table-tree-filter
        filterId="category"
        column="category"
        [options]="tree"
        [multi]="true"
        position="left"
      />
      <ui-data-table-column columnDef="id" label="ID" align="center" />
      <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
      <ui-data-table-column columnDef="price" label="Price" [sortable]="true" align="end" />
      <div emptyState>No products match the selection.</div>
    </ui-data-table>
  `,
})
class MultiSelectHost {
  readonly tree = buildTree(EXTERNAL_DATA);
  readonly data = adaptProducts(EXTERNAL_DATA);
}

// ── Story host: top-positioned tree filter ──

@Component({
  selector: 'ui-tree-filter-top-story',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableTreeFilterComponent],
  template: `
    <ui-data-table [dataSource]="data">
      <ui-data-table-tree-filter
        filterId="category"
        column="category"
        [options]="tree"
        [multi]="true"
        position="top"
      />
      <ui-data-table-column columnDef="id" label="ID" align="center" />
      <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
      <ui-data-table-column columnDef="price" label="Price" [sortable]="true" align="end" />
      <div emptyState>No products match the selection.</div>
    </ui-data-table>
  `,
})
class TopPositionHost {
  readonly tree = buildTree(EXTERNAL_DATA);
  readonly data = adaptProducts(EXTERNAL_DATA);
}

const meta: Meta = {
  title: 'UI/DataTable/TreeFilter',
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj;

export const SingleSelect: Story = {
  render: () => ({ props: {}, template: '<ui-tree-filter-single-story />' }),
  moduleMetadata: { imports: [SingleSelectHost] },
};

export const MultiSelect: Story = {
  render: () => ({ props: {}, template: '<ui-tree-filter-multi-story />' }),
  moduleMetadata: { imports: [MultiSelectHost] },
};

export const TopPosition: Story = {
  render: () => ({ props: {}, template: '<ui-tree-filter-top-story />' }),
  moduleMetadata: { imports: [TopPositionHost] },
};
