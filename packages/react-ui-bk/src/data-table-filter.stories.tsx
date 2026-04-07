import { useState } from "react";
import type { Meta, StoryObj } from "storybook";
import { DataTableFilter, applyFilters, type FilterConfig } from "./data-table-filter";
import { DataTable, type DataTableColumn } from "./data-table";

interface Ship {
  name: string;
  class: string;
  displacement: number;
}

const sampleData: Ship[] = [
  { name: "Charles de Gaulle", class: "Aircraft Carrier", displacement: 42000 },
  { name: "Suffren", class: "Submarine", displacement: 5300 },
  { name: "Alsace", class: "Frigate", displacement: 4600 },
  { name: "Forbin", class: "Destroyer", displacement: 7050 },
  { name: "Mistral", class: "Amphibious", displacement: 21300 },
];

const columns: DataTableColumn<Ship>[] = [
  { accessor: "name", header: "Name", sortable: true },
  { accessor: "class", header: "Class", sortable: true },
  { accessor: "displacement", header: "Displacement (t)", sortable: true },
];

const meta: Meta<typeof DataTableFilter> = {
  title: "Components/DataTableFilter",
  component: DataTableFilter,
};

export default meta;
type Story = StoryObj<typeof DataTableFilter>;

export const Default: Story = {
  args: {
    filterId: "class-filter",
    column: "class",
    children: <span>Filter placeholder</span>,
  },
};

export const WithDataTable: Story = {
  render: () => {
    const [search, setSearch] = useState("");
    const filters: FilterConfig<Ship>[] = search
      ? [{ filterId: "name", column: "name", operator: "contains", value: search }]
      : [];
    const filtered = applyFilters(sampleData, filters);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
        <DataTableFilter filterId="name" column="name" operator="contains">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "var(--spacing-xs) var(--spacing-sm)", width: "100%" }}
          />
        </DataTableFilter>
        <DataTable data={filtered} columns={columns} />
      </div>
    );
  },
};
