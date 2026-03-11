import { Component, signal } from '@angular/core';
import { BadgeComponent } from '../../shared/ui/badge.component';
import {
  HistogramTimelineComponent,
  type HistogramBar,
  type HistogramLabel,
} from '../../shared/ui/histogram-timeline.component';
import { type TechnicalEvent } from './events.types';

function generateEventTimestamps(count: number): Date[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now);
    date.setHours(date.getHours() - (count - i));
    return date;
  });
}

function generateBars(count: number, max: number, seed: number): HistogramBar[] {
  let pseudoRand = seed;
  return Array.from({ length: count }, () => {
    pseudoRand = (pseudoRand * 16807) % 2147483647;
    return { value: Math.floor(((pseudoRand - 1) / 2147483646) * max) };
  });
}

function generateLabels(count: number, interval: number, formatter: (i: number) => string): HistogramLabel[] {
  const labels: HistogramLabel[] = [];
  for (let i = 0; i < count; i += interval) {
    labels.push({ index: i, text: formatter(i) });
  }
  return labels;
}

@Component({
  selector: 'app-events',
  imports: [HistogramTimelineComponent, BadgeComponent],
  template: `
    <div class="flex flex-col gap-xl px-lg py-lg mx-auto" style="max-width: 72rem">

      <!-- Header -->
      <div class="flex flex-row items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Technical Events Timeline</h1>
          <p class="text-sm text-muted-foreground mt-xs">Track system events, deployments, and incidents</p>
        </div>
        <app-badge variant="outline">{{ totalEvents() }} events</app-badge>
      </div>

      <!-- Events distribution histogram -->
      <div class="card">
        <div class="flex flex-row items-center justify-between mb-md">
          <h2 class="card-title" style="margin-block-end: 0">Events over time</h2>
          <span class="font-mono text-xs text-muted-foreground border px-sm py-xs rounded-sm">24h window</span>
        </div>
        <app-histogram-timeline
          [bars]="eventBars()"
          [labels]="eventLabels()"
          [ariaLabel]="'Technical events per hour, last 24 hours'"
          variant="default"
        />
      </div>

      <!-- Events by category -->
      <div class="grid grid-cols-2 gap-md">
        <!-- Deployment events -->
        <div class="card">
          <div class="flex flex-row items-center justify-between mb-md">
            <h3 class="font-semibold text-foreground">Deployments</h3>
            <app-badge variant="default">{{ deploymentCount() }}</app-badge>
          </div>
          <app-histogram-timeline
            [bars]="deploymentBars()"
            [labels]="deploymentLabels()"
            [ariaLabel]="'Deployment events per hour'"
            variant="success"
          />
        </div>

        <!-- Alert events -->
        <div class="card">
          <div class="flex flex-row items-center justify-between mb-md">
            <h3 class="font-semibold text-foreground">Alerts & Incidents</h3>
            <app-badge variant="destructive">{{ alertCount() }}</app-badge>
          </div>
          <app-histogram-timeline
            [bars]="alertBars()"
            [labels]="alertLabels()"
            [ariaLabel]="'Alert events per hour'"
            variant="destructive"
          />
        </div>
      </div>

      <!-- Recent events list -->
      <div class="card">
        <h2 class="card-title mb-md">Recent Events</h2>
        <div class="flex flex-col gap-sm">
          @for (event of events(); track event.id) {
            <div class="flex flex-col gap-xs py-sm border-b border-border last:border-b-0">
              <div class="flex flex-row items-center justify-between">
                <h4 class="font-medium text-foreground">{{ event.title }}</h4>
                <app-badge [variant]="getBadgeVariant(event.severity)">
                  {{ event.category }}
                </app-badge>
              </div>
              <p class="text-sm text-muted-foreground">{{ event.description }}</p>
              <div class="flex flex-row items-center justify-between">
                <span class="text-xs text-muted-foreground">{{ formatTime(event.timestamp) }}</span>
                <span class="text-xs px-sm py-xs bg-secondary text-secondary-foreground rounded">
                  {{ event.severity }}
                </span>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class EventsComponent {
  protected readonly eventBars = signal(generateBars(24, 15, 42));
  protected readonly eventLabels = signal(
    generateLabels(24, 4, i => `${String(i)}:00`),
  );

  protected readonly deploymentBars = signal(generateBars(24, 8, 123));
  protected readonly deploymentLabels = signal(
    generateLabels(24, 6, i => `${String(i)}:00`),
  );

  protected readonly alertBars = signal(generateBars(24, 12, 456));
  protected readonly alertLabels = signal(
    generateLabels(24, 6, i => `${String(i)}:00`),
  );

  protected readonly totalEvents = signal(127);
  protected readonly deploymentCount = signal(8);
  protected readonly alertCount = signal(12);

  protected readonly events = signal<TechnicalEvent[]>([
    {
      id: '1',
      title: 'Production Deployment',
      description: 'Deployed backend v1.8.2 to production with bug fixes',
      timestamp: new Date(Date.now() - 5 * 60000),
      category: 'deployment',
      severity: 'info',
    },
    {
      id: '2',
      title: 'Critical Alert: CPU Spike',
      description: 'Worker node-03 CPU usage exceeded 95% threshold',
      timestamp: new Date(Date.now() - 25 * 60000),
      category: 'alert',
      severity: 'critical',
    },
    {
      id: '3',
      title: 'Release: v2.5.0',
      description: 'New features: dark mode, performance improvements',
      timestamp: new Date(Date.now() - 2 * 3600000),
      category: 'release',
      severity: 'info',
    },
    {
      id: '4',
      title: 'Scheduled Maintenance',
      description: 'Database maintenance window completed successfully',
      timestamp: new Date(Date.now() - 4 * 3600000),
      category: 'maintenance',
      severity: 'warning',
    },
    {
      id: '5',
      title: 'Incident Resolved',
      description: 'API rate limiting issue on /search endpoint fixed',
      timestamp: new Date(Date.now() - 8 * 3600000),
      category: 'incident',
      severity: 'critical',
    },
  ]);

  protected formatTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  protected getBadgeVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  }
}
