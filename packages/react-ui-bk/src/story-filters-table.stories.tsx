import { useState } from "react";
import type { Meta, StoryObj } from "storybook";
import { DataTable, type DataTableColumn } from "./data-table";
import { applyFilters, type FilterConfig } from "./data-table-filter";
import { DataTableTreeFilter } from "./data-table-tree-filter";
import type { TreeFilterNode, TreeSelectionChangeEvent } from "./data-table-tree-filter.types";
import { filterByPaths } from "./data-table-tree-filter.utils";

interface Incident {
  id: number;
  title: string;
  region: string;
  team: string;
  service: string;
  severity: string;
  occurredAt: Date;
}

const RAW_INCIDENTS: Incident[] = [
  { id: 1,  title: "Auth timeout",       region: "EMEA", team: "Platform",  service: "Auth",     severity: "High",   occurredAt: new Date("2025-01-08") },
  { id: 2,  title: "DB replication lag",  region: "EMEA", team: "Platform",  service: "Database", severity: "Medium", occurredAt: new Date("2025-01-22") },
  { id: 3,  title: "CDN cache miss",      region: "EMEA", team: "Frontend",  service: "CDN",      severity: "Low",    occurredAt: new Date("2025-02-05") },
  { id: 4,  title: "Payment failure",     region: "AMER", team: "Payments",  service: "Checkout", severity: "High",   occurredAt: new Date("2025-02-18") },
  { id: 5,  title: "API rate limit",      region: "AMER", team: "Platform",  service: "API",      severity: "Medium", occurredAt: new Date("2025-03-03") },
  { id: 6,  title: "SMS delivery drop",   region: "AMER", team: "Comms",     service: "Notify",   severity: "Low",    occurredAt: new Date("2025-03-17") },
  { id: 7,  title: "Search 503",          region: "APAC", team: "Search",    service: "Search",   severity: "High",   occurredAt: new Date("2025-04-01") },
  { id: 8,  title: "Cache eviction",      region: "APAC", team: "Platform",  service: "Cache",    severity: "Low",    occurredAt: new Date("2025-04-14") },
  { id: 9,  title: "Image resize OOM",    region: "APAC", team: "Media",     service: "Images",   severity: "Medium", occurredAt: new Date("2025-05-02") },
  { id: 10, title: "Auth MFA bypass",     region: "EMEA", team: "Security",  service: "Auth",     severity: "High",   occurredAt: new Date("2025-05-15") },
  { id: 11, title: "Log pipeline drop",   region: "AMER", team: "Observ",    service: "Logging",  severity: "Medium", occurredAt: new Date("2025-06-03") },
  { id: 12, title: "TLS cert expiry",     region: "APAC", team: "Security",  service: "Certs",    severity: "High",   occurredAt: new Date("2025-06-20") },
];

interface IncidentRow {
  id: number;
  title: string;
  category: string[];
  severity: string;
  occurredAt: string;
}

function adaptIncidents(rows: Incident[]): IncidentRow[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: [r.region, r.team, r.service],
    severity: r.severity,
    occurredAt: r.occurredAt.toISOString().slice(0, 10),
  }));
}

function buildTree(rows: Incident[]): TreeFilterNode[] {
  const tree = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    if (!tree.has(row.region)) tree.set(row.region, new Map());
    const teams = tree.get(row.region)!;
    if (!teams.has(row.team)) teams.set(row.team, new Set());
    teams.get(row.team)!.add(row.service);
  }
  const result: TreeFilterNode[] = [];
  for (const [region, teams] of tree) {
    const teamNodes: TreeFilterNode[] = [];
    for (const [team, services] of teams) {
      teamNodes.push({
        value: team,
        children: [...services].map((s) => ({ value: s })),
      });
    }
    result.push({ value: region, children: teamNodes });
  }
  return result;
}

const allData = adaptIncidents(RAW_INCIDENTS);
const treeOptions = buildTree(RAW_INCIDENTS);

const columns: DataTableColumn<IncidentRow>[] = [
  { accessor: "id", header: "ID", sortable: true },
  { accessor: "title", header: "Title", sortable: true },
  { accessor: "severity", header: "Severity", sortable: true },
  { accessor: "occurredAt", header: "Date", sortable: true },
];

function FiltersTablePage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[][]>([]);

  let filtered = allData;

  // Apply date range filters
  const dateFilters: FilterConfig<IncidentRow>[] = [];
  if (fromDate) {
    dateFilters.push({ filterId: "dateFrom", column: "occurredAt", operator: "gte", value: fromDate });
  }
  if (toDate) {
    dateFilters.push({ filterId: "dateTo", column: "occurredAt", operator: "lte", value: toDate });
  }
  filtered = applyFilters(filtered, dateFilters);

  // Apply tree filter
  if (selectedPaths.length > 0) {
    filtered = filterByPaths(filtered, selectedPaths, "category");
  }

  function handleSelectionChange(event: TreeSelectionChangeEvent) {
    setSelectedPaths(event.selectedPaths);
  }

  function clearDates() {
    setFromDate("");
    setToDate("");
  }

  return (
    <div style={{ padding: "var(--spacing-lg)", display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
      {/* Page header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Incident Log</h2>
        <p className="text-sm text-muted-foreground">Filter by region / team / service and date range.</p>
      </div>

      {/* Date range inputs */}
      <div style={{ display: "flex", gap: "var(--spacing-md)", alignItems: "center", flexWrap: "wrap" }}>
        <label className="text-sm text-foreground" style={{ display: "flex", alignItems: "center", gap: "var(--spacing-xs)" }}>
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--spacing-xs) var(--spacing-sm)",
              fontSize: "0.875rem",
              background: "var(--color-card)",
              color: "var(--color-foreground)",
            }}
          />
        </label>
        <label className="text-sm text-foreground" style={{ display: "flex", alignItems: "center", gap: "var(--spacing-xs)" }}>
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--spacing-xs) var(--spacing-sm)",
              fontSize: "0.875rem",
              background: "var(--color-card)",
              color: "var(--color-foreground)",
            }}
          />
        </label>
        {(fromDate || toDate) && (
          <button
            className="text-sm text-muted-foreground"
            style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            onClick={clearDates}
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Table with left hierarchy filter */}
      <div style={{ display: "flex", gap: "var(--spacing-lg)" }}>
        <DataTableTreeFilter
          filterId="category"
          column="category"
          options={treeOptions}
          multi
          position="left"
          onSelectionChange={handleSelectionChange}
        />
        <div style={{ flex: 1 }}>
          <DataTable data={filtered} columns={columns} />
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground" style={{ padding: "var(--spacing-md)", textAlign: "center" }}>
              No incidents match the current filters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Composed/StoryFiltersTable",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  name: "Compact table — left hierarchy multi-select + top date range",
  render: () => <FiltersTablePage />,
};
