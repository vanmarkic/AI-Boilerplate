import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import { DataTableFilterComponent } from './data-table-filter.component';
import type { FilterLogic, FilterPosition } from './data-table-filter.types';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  region: string;
  status: string;
}

const SAMPLE_DATA: Product[] = [
  { id: 1, name: 'Wireless Keyboard', category: 'Peripherals', price: 79.99, region: 'North', status: 'In Stock' },
  { id: 2, name: 'USB-C Hub', category: 'Accessories', price: 49.99, region: 'South', status: 'Low Stock' },
  { id: 3, name: '4K Monitor', category: 'Displays', price: 599.00, region: 'East', status: 'Out of Stock' },
  { id: 4, name: 'Mechanical Mouse', category: 'Peripherals', price: 34.50, region: 'North', status: 'In Stock' },
  { id: 5, name: 'Webcam HD', category: 'Accessories', price: 89.00, region: 'South', status: 'Low Stock' },
  { id: 6, name: 'Laptop Stand', category: 'Accessories', price: 45.00, region: 'West', status: 'In Stock' },
  { id: 7, name: 'Noise-Cancel Headset', category: 'Audio', price: 199.99, region: 'East', status: 'In Stock' },
  { id: 8, name: 'Thunderbolt Dock', category: 'Accessories', price: 279.00, region: 'West', status: 'Low Stock' },
];

const TABLE_IMPORTS = [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent];

@Component({
  selector: 'ui-filter-story-host',
  imports: TABLE_IMPORTS,
  template: `
    <ui-data-table [dataSource]="data" [filterLogic]="filterLogic" [masterFilterPosition]="masterPosition">
      <ui-data-table-filter
        filterId="category"
        column="category"
        operator="equals"
        [value]="categoryFilter()"
        position="top"
      />
      <ui-data-table-filter
        filterId="region"
        column="region"
        operator="equals"
        [value]="regionFilter()"
        position="top"
      />
      <ui-data-table-filter
        filterId="price"
        column="price"
        operator="gt"
        [value]="priceFilter()"
        position="left"
      />
      <ui-data-table-column columnDef="id" label="ID" [sortable]="true" align="center" />
      <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
      <ui-data-table-column columnDef="category" label="Category" [sortable]="true" />
      <ui-data-table-column columnDef="price" label="Price" [sortable]="true" align="end" />
      <ui-data-table-column columnDef="region" label="Region" [sortable]="true" />
      <ui-data-table-column columnDef="status" label="Status" />
      <div emptyState>No products match the current filters.</div>
    </ui-data-table>
    <div style="margin-top:1rem;display:flex;gap:1rem;flex-wrap:wrap;">
      <label>Category:
        <select (change)="categoryFilter.set($any($event.target).value || null)">
          <option value="">All</option>
          <option>Peripherals</option>
          <option>Accessories</option>
          <option>Displays</option>
          <option>Audio</option>
        </select>
      </label>
      <label>Region:
        <select (change)="regionFilter.set($any($event.target).value || null)">
          <option value="">All</option>
          <option>North</option>
          <option>South</option>
          <option>East</option>
          <option>West</option>
        </select>
      </label>
      <label>Min Price:
        <input type="number" (input)="priceFilter.set(+$any($event.target).value || null)" />
      </label>
    </div>
  `,
})
class FilterStoryHostComponent {
  data = SAMPLE_DATA;
  filterLogic: FilterLogic = 'and';
  masterPosition: FilterPosition = 'top';
  categoryFilter = signal<string | null>(null);
  regionFilter = signal<string | null>(null);
  priceFilter = signal<number | null>(null);
}

const meta: Meta<FilterStoryHostComponent> = {
  title: 'UI/DataTable/Filters',
  component: FilterStoryHostComponent,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<FilterStoryHostComponent>;

export const AndFilters: Story = {
  args: { filterLogic: 'and', masterPosition: 'top' },
};

export const OrFilters: Story = {
  args: { filterLogic: 'or', masterPosition: 'top' },
};

export const LeftMaster: Story = {
  args: { filterLogic: 'and', masterPosition: 'left' },
};
