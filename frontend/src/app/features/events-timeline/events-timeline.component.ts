import { Component, ChangeDetectionStrategy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EventsTimelineStore } from './events-timeline.store';

@Component({
  selector: 'app-events-timeline',
  standalone: true,
  imports: [CommonModule, BadgeComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline-container">
      <h1 class="text-2xl font-bold mb-lg">Technical Events Timeline</h1>

      @if (store.loading()) {
        <div class="text-center py-xl">
          <p class="text-muted">Loading events...</p>
        </div>
      } @else if (store.error(); as error) {
        <div class="text-center py-xl">
          <p class="text-destructive">{{ error }}</p>
        </div>
      } @else if (store.events().length > 0) {
        <div class="timeline">
          @for (event of store.events(); track event.id) {
            <div class="timeline-item" [attr.data-status]="event.status">
              <div class="timeline-marker"></div>
              <app-card class="timeline-card">
                <div class="event-header">
                  <h2 class="text-lg font-semibold">{{ event.title }}</h2>
                  <app-badge [attr.data-variant]="getStatusVariant(event.status)">
                    {{ event.status }}
                  </app-badge>
                </div>

                <p class="text-sm text-muted mb-md">{{ event.description }}</p>

                <div class="event-meta">
                  <div class="meta-item">
                    <span class="meta-label">Date:</span>
                    <span class="meta-value">{{ event.eventDate | date: 'short' }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Type:</span>
                    <app-badge data-variant="secondary">{{ event.eventType }}</app-badge>
                  </div>
                  @if (event.location) {
                    <div class="meta-item">
                      <span class="meta-label">Location:</span>
                      <span class="meta-value">{{ event.location }}</span>
                    </div>
                  }
                  @if (event.url) {
                    <div class="meta-item">
                      <a [href]="event.url" target="_blank" class="text-primary hover:underline">
                        Event Link →
                      </a>
                    </div>
                  }
                </div>
              </app-card>
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-xl">
          <p class="text-muted">No events found</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline-container {
      padding: var(--spacing-lg);
      max-width: 800px;
      margin: 0 auto;
    }

    .timeline {
      position: relative;
      padding: var(--spacing-lg) 0;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 24px;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: var(--color-border);
    }

    .timeline-item {
      margin-bottom: var(--spacing-xl);
      position: relative;
      padding-left: var(--spacing-2xl);
    }

    .timeline-marker {
      position: absolute;
      left: 16px;
      top: 8px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: var(--color-primary);
      border: 2px solid var(--color-background);
      box-shadow: 0 0 0 3px var(--color-border);
    }

    .timeline-item[data-status='completed'] .timeline-marker {
      background-color: var(--color-success);
    }

    .timeline-item[data-status='cancelled'] .timeline-marker {
      background-color: var(--color-destructive);
    }

    .timeline-card {
      transition: all 0.2s ease;
    }

    .timeline-card:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-md);
    }

    .event-meta {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
      padding-top: var(--spacing-md);
      border-top: 1px solid var(--color-border);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .meta-label {
      font-weight: 500;
      color: var(--color-muted);
      min-width: 70px;
    }

    .meta-value {
      color: var(--color-foreground);
    }
  `],
})
export class EventsTimelineComponent {
  protected readonly store = inject(EventsTimelineStore);

  constructor() {
    effect(() => {
      // Load events when component initializes
      this.store.loadAll();
    });
  }

  getStatusVariant(status: string): string {
    switch (status) {
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'destructive';
      case 'upcoming':
      default:
        return 'primary';
    }
  }
}
