import type { Meta, StoryObj } from 'storybook';
import { DataTable } from './data-table';
import type { DataTableColumn } from './data-table';

interface Ship {
  name: string;
  class: string;
  displacement: number;
}

const sampleData: Ship[] = [
  { name: 'Charles de Gaulle', class: 'Aircraft Carrier', displacement: 42000 },
  { name: 'Suffren', class: 'Submarine', displacement: 5300 },
  { name: 'Alsace', class: 'Frigate', displacement: 4600 },
  { name: 'Forbin', class: 'Destroyer', displacement: 7050 },
  { name: 'Mistral', class: 'Amphibious', displacement: 21300 },
];

const columns: DataTableColumn<Ship>[] = [
  { accessor: 'name', header: 'Name', sortable: true },
  { accessor: 'class', header: 'Class', sortable: true },
  {
    accessor: 'displacement',
    header: 'Displacement (t)',
    sortable: true,
    cell: (row) => row.displacement.toLocaleString(),
  },
];

const meta: Meta<typeof DataTable<Ship>> = {
  title: 'Components/DataTable',
  component: DataTable,
};

export default meta;
type Story = StoryObj<typeof DataTable<Ship>>;

export const Default: Story = {
  args: { data: sampleData, columns },
};

export const WithSorting: Story = {
  args: { data: sampleData, columns },
};

export const WithClickableRows: Story = {
  args: { data: sampleData, columns, clickableRows: true },
};

export const Empty: Story = {
  args: { data: [], columns },
};
