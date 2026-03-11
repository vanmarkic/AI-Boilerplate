import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { IncidentsStore } from './incidents.store';
import { IncidentFilters } from './incidents.types';

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="incidents-container">
      <h1>Technical Incidents Dashboard</h1>

      <!-- Filters -->
      <div class="filters-section">
        <h2>Filters</h2>
        <form [formGroup]="filterForm" class="filter-form">
          <div class="form-group">
            <label for="severity">Severity:</label>
            <select id="severity" formControlName="severity" class="form-control">
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div class="form-group">
            <label for="status">Status:</label>
            <select id="status" formControlName="status" class="form-control">
              <option value="">All</option>
              <option value="ongoing">Ongoing</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <button type="button" (click)="applyFilters()" class="btn btn-primary">
            Apply Filters
          </button>
        </form>
      </div>

      <!-- Histogram Section -->
      <div class="histogram-section">
        <h2>Incident Timeline</h2>
        @if (store.histogramData().length > 0) {
          <div class="histogram-chart">
            @for (item of store.histogramData(); track item.period) {
              <div class="histogram-bar-container">
                <div
                  class="histogram-bar"
                  [style.height.px]="getBarHeight(item.count)"
                  [attr.data-count]="item.count"
                >
                </div>
                <span class="histogram-label">{{ formatDate(item.period) }}</span>
              </div>
            }
          </div>
        } @else {
          <p>No histogram data available</p>
        }
      </div>

      <!-- Incidents List -->
      <div class="incidents-list-section">
        <h2>Incidents List</h2>
        @if (store.loading()) {
          <p class="loading">Loading incidents...</p>
        } @else if (store.error(); as error) {
          <p class="error">Error loading incidents: {{ error }}</p>
        } @else if (store.incidents().length > 0) {
          <div class="incidents-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                @for (incident of store.incidents(); track incident.id) {
                  <tr [attr.data-severity]="incident.severity">
                    <td>{{ incident.id }}</td>
                    <td>{{ incident.title }}</td>
                    <td class="severity-badge">{{ incident.severity }}</td>
                    <td class="status-badge">{{ incident.status }}</td>
                    <td>{{ formatDate(incident.started_at) }}</td>
                    <td>{{ calculateDuration(incident.started_at, incident.ended_at) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p>No incidents found</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .incidents-container {
      padding: 2rem;
      background: var(--color-background);
    }

    h1 {
      color: var(--color-primary);
      margin-bottom: 1.5rem;
    }

    h2 {
      color: var(--color-primary);
      margin-top: 1.5rem;
      margin-bottom: 1rem;
    }

    .filters-section {
      background: var(--color-card);
      padding: 1.5rem;
      border-radius: var(--radius-md);
      margin-bottom: 2rem;
    }

    .filter-form {
      display: flex;
      gap: 1rem;
      align-items: flex-end;
      flex-wrap: wrap;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-weight: 500;
    }

    .form-control {
      padding: 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }

    .btn {
      padding: 0.5rem 1rem;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    .histogram-section {
      background: var(--color-card);
      padding: 1.5rem;
      border-radius: var(--radius-md);
      margin-bottom: 2rem;
    }

    .histogram-chart {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
      height: 200px;
      padding: 1rem 0;
    }

    .histogram-bar-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .histogram-bar {
      width: 100%;
      background: var(--color-primary);
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      min-height: 2px;
      transition: all 0.3s ease;
    }

    .histogram-bar:hover {
      background: var(--color-primary-dark);
      opacity: 0.8;
    }

    .histogram-label {
      font-size: 0.75rem;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }

    .incidents-list-section {
      background: var(--color-card);
      padding: 1.5rem;
      border-radius: var(--radius-md);
    }

    .incidents-table {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: var(--color-muted);
    }

    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--color-border);
    }

    tbody tr:hover {
      background: var(--color-muted);
    }

    .severity-badge, .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .severity-badge {
      background: var(--color-warning);
      color: white;
    }

    tr[data-severity="critical"] .severity-badge {
      background: var(--color-destructive);
    }

    tr[data-severity="high"] .severity-badge {
      background: #ff9800;
    }

    tr[data-severity="medium"] .severity-badge {
      background: #ffc107;
      color: black;
    }

    tr[data-severity="low"] .severity-badge {
      background: var(--color-success);
    }

    .status-badge {
      background: var(--color-info);
      color: white;
    }

    .loading, .error {
      padding: 1rem;
      text-align: center;
    }

    .error {
      color: var(--color-destructive);
    }
  `],
  host: {
    class: 'block'
  }
})
export class IncidentsComponent implements OnInit {
  protected readonly store = inject(IncidentsStore);

  filterForm = new FormGroup({
    severity: new FormControl(''),
    status: new FormControl(''),
  });

  ngOnInit() {
    // Load initial data
    this.store.loadIncidents({});
    this.store.loadHistogramData('day');
  }

  applyFilters(): void {
    const filters: IncidentFilters = {
      severity: this.filterForm.get('severity')?.value || undefined,
      status: this.filterForm.get('status')?.value || undefined,
    };
    this.store.updateFilters(filters);
    this.store.loadIncidents(filters);
  }

  getBarHeight(count: number): number {
    const maxCount = Math.max(...this.store.histogramData().map(h => h.count), 1);
    return (count / maxCount) * 150;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  calculateDuration(startedAt: string, endedAt: string | null): string {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
}
