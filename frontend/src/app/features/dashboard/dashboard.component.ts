import { Component, signal } from '@angular/core';
import {
  HistogramTimelineComponent,
  type HistogramBar,
  type HistogramLabel,
} from '../../shared/ui/histogram-timeline.component';

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

@Component({
  selector: 'app-dashboard',
  imports: [HistogramTimelineComponent],
  template: `
    <div class="flex flex-col gap-xl px-lg py-lg max-w-container-2xl">
      <h1 class="text-2xl font-bold text-foreground">Dashboard</h1>

      <div class="card">
        <h2 class="card-title">Events per minute</h2>
        <div class="card-content">
          <app-histogram-timeline
            [bars]="bars()"
            [labels]="labels()"
            [ariaLabel]="'Events per minute, last 12 hours'"
          />
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
}
