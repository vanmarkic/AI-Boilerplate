import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { HistogramTimelineComponent } from '../../shared/ui/histogram-timeline.component';
import { createEventHistogramData, EventStore } from './event.store';

@Component({
  selector: 'app-event',
  standalone: true,
  imports: [CommonModule, HistogramTimelineComponent],
  template: `
    <div class="event-container">
      @if (store.loading()) {
        <p class="loading">Loading events...</p>
      } @else if (store.error(); as error) {
        <p class="error">{{ error }}</p>
      } @else {
        @if (store.items().length > 0) {
          <div class="event-timeline">
            <h2>Event Timeline</h2>
            <app-histogram-timeline
              [bars]="histogramBars()"
              [labels]="histogramLabels()"
              [variant]="'default'"
              [ariaLabel]="'Event distribution over time'"
            />
          </div>
          <div class="event-list">
            <h2>Events</h2>
            <ul>
              @for (event of store.items(); track event.id) {
                <li class="event-item" [attr.data-severity]="event.severity">
                  <div class="event-header">
                    <strong>{{ event.event_type }}</strong>
                    <span class="severity">{{ event.severity }}</span>
                  </div>
                  <p>{{ event.description }}</p>
                  <small>{{ event.timestamp | date: 'medium' }}</small>
                </li>
              }
            </ul>
          </div>
        } @else {
          <p class="no-events">No events found for the selected time range.</p>
        }
      }
    </div>
  `,
  styles: [`
    .event-container {
      padding: var(--spacing-md);
    }
    .event-timeline {
      margin-bottom: var(--spacing-lg);
    }
    .event-list {
      margin-top: var(--spacing-lg);
    }
    .event-item {
      padding: var(--spacing-md);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-sm);
    }
    .event-item[data-severity="critical"] {
      border-left: 4px solid var(--color-destructive);
    }
    .event-item[data-severity="error"] {
      border-left: 4px solid var(--color-destructive);
    }
    .event-item[data-severity="warning"] {
      border-left: 4px solid var(--color-warning);
    }
    .event-item[data-severity="info"] {
      border-left: 4px solid var(--color-primary);
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-xs);
    }
    .severity {
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: 500;
    }
    .event-item[data-severity="critical"] .severity,
    .event-item[data-severity="error"] .severity {
      background-color: var(--color-destructive);
      color: white;
    }
    .event-item[data-severity="warning"] .severity {
      background-color: var(--color-warning);
      color: white;
    }
    .event-item[data-severity="info"] .severity {
      background-color: var(--color-primary);
      color: white;
    }
    .loading, .error, .no-events {
      text-align: center;
      padding: var(--spacing-lg);
      color: var(--color-muted-foreground);
    }
    .error {
      color: var(--color-destructive);
    }
  `],
})
export class EventComponent {
  protected readonly store = inject(EventStore);
  bucketSizeSeconds = input(60, { alias: 'bucketSize' });

  histogramData = computed(() =>
    createEventHistogramData(this.store.items(), this.bucketSizeSeconds()),
  );

  histogramBars = computed(() => this.histogramData().bars);
  histogramLabels = computed(() => this.histogramData().labels);
}
