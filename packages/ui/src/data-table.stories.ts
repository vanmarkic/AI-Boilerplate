import type { Meta, StoryObj } from '@storybook/angular';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
}

const SAMPLE_DATA: Product[] = [
  { id: 1, name: 'Wireless Keyboard', category: 'Peripherals', price: 79.99, stock: 142, status: 'In Stock' },
  { id: 2, name: 'USB-C Hub', category: 'Accessories', price: 49.99, stock: 38, status: 'Low Stock' },
  { id: 3, name: '4K Monitor', category: 'Displays', price: 599.00, stock: 0, status: 'Out of Stock' },
  { id: 4, name: 'Mechanical Mouse', category: 'Peripherals', price: 34.50, stock: 210, status: 'In Stock' },
  { id: 5, name: 'Webcam HD', category: 'Accessories', price: 89.00, stock: 15, status: 'Low Stock' },
  { id: 6, name: 'Laptop Stand', category: 'Accessories', price: 45.00, stock: 67, status: 'In Stock' },
  { id: 7, name: 'Noise-Cancel Headset', category: 'Audio', price: 199.99, stock: 23, status: 'In Stock' },
  { id: 8, name: 'Thunderbolt Dock', category: 'Accessories', price: 279.00, stock: 5, status: 'Low Stock' },
];

const TABLE_IMPORTS = [DataTableComponent, DataTableColumnComponent];

const meta: Meta<DataTableComponent<Product>> = {
  title: 'UI/DataTable',
  component: DataTableComponent,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['default', 'compact'] },
    striped: { control: 'boolean' },
    multiSort: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<DataTableComponent<Product>>;

export const Default: Story = {
  args: { dataSource: SAMPLE_DATA, size: 'default', striped: false, multiSort: false },
  render: (args) => ({
    props: args,
    template: `
      <ui-data-table [dataSource]="dataSource" [size]="size" [striped]="striped" [multiSort]="multiSort">
        <ui-data-table-column columnDef="id" label="ID" [sortable]="true" align="center" />
        <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
        <ui-data-table-column columnDef="category" label="Category" [sortable]="true" />
        <ui-data-table-column columnDef="price" label="Price" [sortable]="true" align="end" />
        <ui-data-table-column columnDef="stock" label="Stock" [sortable]="true" align="end" />
        <ui-data-table-column columnDef="status" label="Status" />
      </ui-data-table>
    `,
    moduleMetadata: { imports: TABLE_IMPORTS },
  }),
};

export const Compact: Story = {
  args: { dataSource: SAMPLE_DATA, size: 'compact', striped: false, multiSort: false },
  render: Default.render,
};

export const Striped: Story = {
  args: { dataSource: SAMPLE_DATA, size: 'default', striped: true, multiSort: false },
  render: Default.render,
};

export const CompactStriped: Story = {
  args: { dataSource: SAMPLE_DATA, size: 'compact', striped: true, multiSort: false },
  render: Default.render,
};

export const MultiSort: Story = {
  args: { dataSource: SAMPLE_DATA, size: 'default', striped: false, multiSort: true },
  render: Default.render,
};

export const DefaultSorted: Story = {
  args: {
    dataSource: SAMPLE_DATA,
    size: 'default',
    striped: false,
    multiSort: false,
    defaultSort: [{ column: 'price', direction: 'desc' }],
  },
  render: (args) => ({
    props: args,
    template: `
      <ui-data-table
        [dataSource]="dataSource"
        [size]="size"
        [striped]="striped"
        [multiSort]="multiSort"
        [defaultSort]="defaultSort"
      >
        <ui-data-table-column columnDef="id" label="ID" [sortable]="true" align="center" />
        <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
        <ui-data-table-column columnDef="price" label="Price" [sortable]="true" align="end" />
        <ui-data-table-column columnDef="stock" label="Stock" [sortable]="true" align="end" />
        <ui-data-table-column columnDef="status" label="Status" />
      </ui-data-table>
    `,
    moduleMetadata: { imports: TABLE_IMPORTS },
  }),
};

export const ClickableRows: Story = {
  args: { dataSource: SAMPLE_DATA, size: 'default', striped: false, multiSort: false },
  render: (args) => ({
    props: { ...args, lastClicked: null, onRowClick: (row: Product) => { args['lastClicked'] = row; } },
    template: `
      <ui-data-table
        [dataSource]="dataSource"
        [size]="size"
        [striped]="striped"
        [clickableRows]="true"
        (rowClick)="onRowClick($event)"
      >
        <ui-data-table-column columnDef="id" label="ID" align="center" />
        <ui-data-table-column columnDef="name" label="Name" [sortable]="true" />
        <ui-data-table-column columnDef="category" label="Category" />
        <ui-data-table-column columnDef="price" label="Price" align="end" />
        <ui-data-table-column columnDef="status" label="Status" />
      </ui-data-table>
      @if (lastClicked) {
        <p style="margin-top:1rem;font-size:0.875rem">
          Clicked: <strong>{{ lastClicked.name }}</strong>
        </p>
      }
    `,
    moduleMetadata: { imports: TABLE_IMPORTS },
  }),
};

export const Empty: Story = {
  args: { dataSource: [] as Product[], size: 'default', striped: false, multiSort: false },
  render: (args) => ({
    props: args,
    template: `
      <ui-data-table [dataSource]="dataSource" [size]="size">
        <ui-data-table-column columnDef="id" label="ID" />
        <ui-data-table-column columnDef="name" label="Name" />
        <div emptyState>No products found.</div>
      </ui-data-table>
    `,
    moduleMetadata: { imports: TABLE_IMPORTS },
  }),
};
