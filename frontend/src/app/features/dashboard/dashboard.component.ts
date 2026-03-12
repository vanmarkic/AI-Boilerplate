import { Component, signal } from '@angular/core';
import { BadgeComponent, HistogramTimelineComponent, type HistogramBar, type HistogramLabel } from '@aspect/ui';

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function generateBars(count: number, max: number, seed: number): HistogramBar[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({ value: Math.floor(rand() * max) }));
}

function generateLabels(count: number, interval: number, formatter: (i: number) => string): HistogramLabel[] {
  const labels: HistogramLabel[] = [];
  for (let i = 0; i < count; i += interval) {
    labels.push({ index: i, text: formatter(i) });
  }
  return labels;
}

interface StatCard {
  label: string;
  value: string;
  change: string;
  up: boolean;
}

interface ActivityItem {
  action: string;
  target: string;
  time: string;
  badge: 'default' | 'secondary' | 'destructive' | 'outline';
  badgeLabel: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [HistogramTimelineComponent, BadgeComponent],
  template: `
    <div class="flex flex-col gap-xl px-lg py-lg mx-auto" style="max-width: 72rem">

      <!-- Header -->
      <div class="flex flex-row items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Dashboard</h1>
          <p class="text-sm text-muted-foreground mt-xs">Monday, March 11 2026</p>
        </div>
        <ui-badge variant="outline">Live</ui-badge>
      </div>

      <!-- Stat cards row -->
      <div class="grid grid-cols-4 gap-md">
        @for (stat of stats; track stat.label) {
          <div class="card">
            <p class="text-xs text-muted-foreground uppercase tracking-wide font-medium">{{ stat.label }}</p>
            <p class="text-2xl font-bold text-foreground mt-xs">{{ stat.value }}</p>
            <p class="text-xs mt-xs" [class]="stat.up ? 'text-xs mt-xs text-primary' : 'text-xs mt-xs text-destructive'">
              {{ stat.change }}
            </p>
          </div>
        }
      </div>

      <!-- Main content: histogram + activity feed -->
      <div class="grid grid-cols-3 gap-md">

        <!-- Histogram card (2/3 width) -->
        <div class="card col-span-2">
          <div class="flex flex-row items-center justify-between mb-md">
            <h2 class="card-title" style="margin-block-end: 0">Events per minute</h2>
            <span class="font-mono text-xs text-muted-foreground border px-sm py-xs rounded-sm">12h window</span>
          </div>
          <ui-histogram-timeline
            [bars]="bars()"
            [labels]="labels()"
            [ariaLabel]="'Events per minute, last 12 hours'"
          />
        </div>

        <!-- Activity feed (1/3 width) -->
        <div class="card flex flex-col">
          <h2 class="card-title">Recent activity</h2>
          <div class="flex flex-col gap-sm flex-1">
            @for (item of activity; track item.time) {
              <div class="flex flex-col gap-xs py-sm" style="border-bottom: 1px solid var(--color-border)">
                <div class="flex flex-row items-center justify-between">
                  <span class="text-sm text-foreground font-medium">{{ item.action }}</span>
                  <ui-badge [variant]="item.badge">{{ item.badgeLabel }}</ui-badge>
                </div>
                <p class="text-xs text-muted-foreground">{{ item.target }}</p>
                <p class="text-xs text-muted-foreground" style="opacity: 0.6">{{ item.time }}</p>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Bottom row: error histogram + system info -->
      <div class="grid grid-cols-3 gap-md">

        <!-- Error rate histogram -->
        <div class="card col-span-2">
          <div class="flex flex-row items-center justify-between mb-md">
            <h2 class="card-title" style="margin-block-end: 0">Error rate</h2>
            <ui-badge variant="destructive">3 spikes</ui-badge>
          </div>
          <ui-histogram-timeline
            [bars]="errorBars()"
            [labels]="errorLabels()"
            [ariaLabel]="'Errors per hour, last 24 hours'"
            variant="destructive"
          />
        </div>

        <!-- System status -->
        <div class="card flex flex-col gap-md">
          <h2 class="card-title">System</h2>
          @for (item of systemInfo; track item.label) {
            <div class="flex flex-row items-center justify-between">
              <span class="text-sm text-muted-foreground">{{ item.label }}</span>
              <span class="font-mono text-sm text-foreground">{{ item.value }}</span>
            </div>
          }
          <div style="border-top: 1px solid var(--color-border)" class="py-sm mt-sm">
            <div class="flex flex-row items-center gap-sm">
              <span class="rounded-full bg-primary" style="width: 0.5rem; height: 0.5rem"></span>
              <span class="text-xs text-muted-foreground">All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  protected readonly bars = signal(generateBars(720, 50, 42));
  protected readonly labels = signal(
    generateLabels(720, 60, i => {
      const hour = 8 + Math.floor(i / 60);
      return `${String(hour)}:${String(i % 60).padStart(2, '0')}`;
    }),
  );

  protected readonly errorBars = signal(generateBars(24, 15, 99));
  protected readonly errorLabels = signal(
    generateLabels(24, 4, i => `${String(i)}:00`),
  );

  protected readonly stats: StatCard[] = [
    { label: 'Total events', value: '14,892', change: '+12.3% vs yesterday', up: true },
    { label: 'Avg latency', value: '42ms', change: '-8.1% vs yesterday', up: true },
    { label: 'Error rate', value: '0.24%', change: '+0.03% vs yesterday', up: false },
    { label: 'Active users', value: '1,247', change: '+5.7% vs yesterday', up: true },
  ];

  protected readonly activity: ActivityItem[] = [
    { action: 'Deployment', target: 'frontend v2.4.1 → production', time: '2 min ago', badge: 'default', badgeLabel: 'deploy' },
    { action: 'Alert resolved', target: 'CPU spike on worker-03', time: '18 min ago', badge: 'secondary', badgeLabel: 'resolved' },
    { action: 'Error spike', target: '429 rate-limit on /api/search', time: '1h ago', badge: 'destructive', badgeLabel: 'error' },
    { action: 'Config change', target: 'Feature flag dark-mode enabled', time: '3h ago', badge: 'outline', badgeLabel: 'config' },
    { action: 'Deployment', target: 'backend v1.8.0 → staging', time: '5h ago', badge: 'default', badgeLabel: 'deploy' },
  ];

  protected readonly systemInfo = [
    { label: 'Uptime', value: '14d 7h 32m' },
    { label: 'CPU', value: '23%' },
    { label: 'Memory', value: '4.2 / 8 GB' },
    { label: 'Disk', value: '67% used' },
    { label: 'DB connections', value: '42 / 100' },
  ];
}
