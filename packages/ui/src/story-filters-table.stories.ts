import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { DataTableComponent } from './data-table.component';
import { DataTableColumnComponent } from './data-table-column.component';
import { DataTableFilterComponent } from './data-table-filter.component';
import { DataTableTreeFilterComponent } from './data-table-tree-filter.component';
import type { TreeFilterNode } from './data-table-tree-filter.types';

// ── External data format ──

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
  { id: 1,  title: 'Auth timeout',       region: 'EMEA',   team: 'Platform',   service: 'Auth',     severity: 'High',   occurredAt: new Date('2025-01-08') },
  { id: 2,  title: 'DB replication lag', region: 'EMEA',   team: 'Platform',   service: 'Database', severity: 'Medium', occurredAt: new Date('2025-01-22') },
  { id: 3,  title: 'CDN cache miss',     region: 'EMEA',   team: 'Frontend',   service: 'CDN',      severity: 'Low',    occurredAt: new Date('2025-02-05') },
  { id: 4,  title: 'Payment failure',    region: 'AMER',   team: 'Payments',   service: 'Checkout', severity: 'High',   occurredAt: new Date('2025-02-18') },
  { id: 5,  title: 'API rate limit',     region: 'AMER',   team: 'Platform',   service: 'API',      severity: 'Medium', occurredAt: new Date('2025-03-03') },
  { id: 6,  title: 'SMS delivery drop',  region: 'AMER',   team: 'Comms',      service: 'Notify',   severity: 'Low',    occurredAt: new Date('2025-03-17') },
  { id: 7,  title: 'Search 503',         region: 'APAC',   team: 'Search',     service: 'Search',   severity: 'High',   occurredAt: new Date('2025-04-01') },
  { id: 8,  title: 'Cache eviction',     region: 'APAC',   team: 'Platform',   service: 'Cache',    severity: 'Low',    occurredAt: new Date('2025-04-14') },
  { id: 9,  title: 'Image resize OOM',   region: 'APAC',   team: 'Media',      service: 'Images',   severity: 'Medium', occurredAt: new Date('2025-05-02') },
  { id: 10, title: 'Auth MFA bypass',    region: 'EMEA',   team: 'Security',   service: 'Auth',     severity: 'High',   occurredAt: new Date('2025-05-15') },
  { id: 11, title: 'Log pipeline drop',  region: 'AMER',   team: 'Observ',     service: 'Logging',  severity: 'Medium', occurredAt: new Date('2025-06-03') },
  { id: 12, title: 'TLS cert expiry',    region: 'APAC',   team: 'Security',   service: 'Certs',    severity: 'High',   occurredAt: new Date('2025-06-20') },
];

// ── Internal format: hierarchical category as path array ──

interface IncidentRow {
  id: number;
  title: string;
  category: string[];   // [region, team, service]
  severity: string;
  occurredAt: Date;
}

function adaptIncidents(rows: Incident[]): IncidentRow[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: [r.region, r.team, r.service],
    severity: r.severity,
    occurredAt: r.occurredAt,
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

// ── Story host ──

@Component({
  selector: 'ui-story-filters-table-host',
  imports: [DataTableComponent, DataTableColumnComponent, DataTableFilterComponent, DataTableTreeFilterComponent],
  template: `
    <div style="padding: var(--spacing-lg); display: flex; flex-direction: column; gap: var(--spacing-md);">
      <!-- Page header -->
      <div>
        <h2 class="text-lg font-bold text-foreground">Incident Log</h2>
        <p class="text-sm text-muted-foreground">Filter by region / team / service and date range.</p>
      </div>

      <!-- Date range inputs -->
      <div style="display: flex; gap: var(--spacing-md); align-items: center; flex-wrap: wrap;">
        <label class="text-sm text-foreground" style="display: flex; align-items: center; gap: var(--spacing-xs);">
          From
          <input
            type="date"
            style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--spacing-xs) var(--spacing-sm); font-size: 0.875rem; background: var(--color-card); color: var(--color-foreground);"
            (change)="onFromChange($any($event.target).value)"
          />
        </label>
        <label class="text-sm text-foreground" style="display: flex; align-items: center; gap: var(--spacing-xs);">
          To
          <input
            type="date"
            style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--spacing-xs) var(--spacing-sm); font-size: 0.875rem; background: var(--color-card); color: var(--color-foreground);"
            (change)="onToChange($any($event.target).value)"
          />
        </label>
        @if (fromDate() || toDate()) {
          <button
            class="text-sm text-muted-foreground"
            style="background: none; border: none; cursor: pointer; text-decoration: underline;"
            (click)="clearDates()"
          >Clear dates</button>
        }
      </div>

      <!-- Table with left hierarchy filter and top date range filters -->
      <ui-data-table [dataSource]="data" size="compact">
        <!-- Date range: top position, two filters (gte + lte) -->
        <ui-data-table-filter
          filterId="dateFrom"
          column="occurredAt"
          operator="gte"
          [value]="fromDate()"
          position="top"
        />
        <ui-data-table-filter
          filterId="dateTo"
          column="occurredAt"
          operator="lte"
          [value]="toDate()"
          position="top"
        />

        <!-- Left hierarchy multi-select: region → team → service -->
        <ui-data-table-tree-filter
          filterId="category"
          column="category"
          [options]="tree"
          [multi]="true"
          position="left"
        />

        <ui-data-table-column columnDef="id"         label="ID"       align="center" />
        <ui-data-table-column columnDef="title"      label="Title"    [sortable]="true" />
        <ui-data-table-column columnDef="severity"   label="Severity" [sortable]="true" />
        <ui-data-table-column columnDef="occurredAt" label="Date"     [sortable]="true" />
        <div emptyState>No incidents match the current filters.</div>
      </ui-data-table>
    </div>
  `,
})
class StoryFiltersTableHostComponent {
  readonly tree = buildTree(RAW_INCIDENTS);
  readonly data = adaptIncidents(RAW_INCIDENTS);

  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);

  onFromChange(value: string): void {
    this.fromDate.set(value ? new Date(value) : null);
  }

  onToChange(value: string): void {
    this.toDate.set(value ? new Date(value) : null);
  }

  clearDates(): void {
    this.fromDate.set(null);
    this.toDate.set(null);
  }
}

// ── Storybook metadata ──

const meta: Meta = {
  title: 'Composed/StoryFiltersTable',
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: 'Compact table — left hierarchy multi-select + top date range',
  render: () => ({
    props: {},
    template: '<ui-story-filters-table-host />',
    moduleMetadata: { imports: [StoryFiltersTableHostComponent] },
  }),
};
