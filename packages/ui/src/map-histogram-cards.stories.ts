import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { CardComponent } from './card.component';
import { DrawerPanelComponent } from './drawer-panel.component';
import { GridComponent } from './grid.component';
import { HistogramTimelineComponent } from './histogram-timeline.component';
import { MapMarkerComponent } from './map-marker.component';
import { MapViewComponent } from './map-view.component';

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function generateBars(count: number, maxValue: number, seed = 42) {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    value: Math.floor(rand() * maxValue),
  }));
}

function generateLabels(
  barCount: number,
  interval: number,
  formatter: (i: number) => string,
) {
  const labels = [];
  for (let i = 0; i < barCount; i += interval) {
    labels.push({ index: i, text: formatter(i) });
  }
  return labels;
}

const CARD_GROUPS = [
  {
    title: 'Infrastructure',
    cards: [
      { title: 'CPU Usage', body: '72% average across 12 nodes.' },
      { title: 'Memory', body: '48 GB / 64 GB allocated.' },
      { title: 'Disk I/O', body: '1,240 IOPS — within normal range.' },
      { title: 'Network', body: '320 Mbps throughput, 0.2% packet loss.' },
    ],
  },
  {
    title: 'Application',
    cards: [
      { title: 'Requests', body: '14,820 req/min — up 6% from baseline.' },
      { title: 'Latency P99', body: '142 ms — under 200 ms SLA target.' },
      { title: 'Error Rate', body: '0.03% — 12 errors in the last hour.' },
      { title: 'Uptime', body: '99.98% over the last 30 days.' },
    ],
  },
  {
    title: 'Security',
    cards: [
      { title: 'Auth Failures', body: '7 failed login attempts today.' },
      { title: 'Active Sessions', body: '482 concurrent user sessions.' },
      { title: 'TLS Certs', body: '3 certificates expiring in 14 days.' },
      { title: 'Audit Events', body: '1,892 events logged this hour.' },
    ],
  },
  {
    title: 'Deployment',
    cards: [
      { title: 'Last Deploy', body: 'v2.14.3 deployed 42 minutes ago.' },
      { title: 'Pipeline', body: '3 builds queued, 1 running.' },
      { title: 'Rollbacks', body: '0 rollbacks in the last 7 days.' },
      { title: 'Coverage', body: '87.4% line coverage on main branch.' },
    ],
  },
];

const cardGroupsTemplate = CARD_GROUPS.map(
  (group) => `
    <div>
      <p class="text-sm font-semibold" style="margin-bottom: var(--spacing-sm)">${group.title}</p>
      <ui-grid [cols]="2" gap="sm">
        ${group.cards.map((c) => `<ui-card title="${c.title}">${c.body}</ui-card>`).join('\n        ')}
      </ui-grid>
    </div>`,
).join('\n');

const meta: Meta = {
  title: 'Composed/MapHistogramCards',
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => ({
    props: {
      drawerOpen: true,
      mapCenter: { lng: -122.42, lat: 37.77 },
      markers: [
        { lng: -122.42, lat: 37.77 },
        { lng: -122.40, lat: 37.79 },
        { lng: -122.44, lat: 37.76 },
        { lng: -122.38, lat: 37.78 },
      ],
      bars: generateBars(720, 50),
      labels: generateLabels(
        720,
        60,
        (i) =>
          `${String(Math.floor(i / 60))}:${String(i % 60).padStart(2, '0')}`,
      ),
      toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
      },
    },
    template: `
      <div style="height: 100dvh; display: flex; flex-direction: column">
        <!-- Top bar with map toggle -->
        <div style="padding: var(--spacing-sm) var(--spacing-lg); border-bottom: 1px solid var(--color-border); display: flex; justify-content: flex-end">
          <ui-button variant="outline" (click)="toggleDrawer()">
            {{ drawerOpen ? 'Hide Map' : 'Show Map' }}
          </ui-button>
        </div>

        <!-- Main content: 4 groups of 4 cards -->
        <div style="flex: 1; min-height: 0; overflow-y: auto; padding: var(--spacing-lg)">
          <ui-grid [cols]="2" gap="md">
            ${cardGroupsTemplate}
          </ui-grid>
        </div>

        <!-- Bottom: histogram with 720 bars -->
        <div style="border-top: 1px solid var(--color-border); padding: var(--spacing-sm) var(--spacing-lg)">
          <ui-histogram-timeline
            [bars]="bars"
            [labels]="labels"
            ariaLabel="Events per minute (12 hours)"
            variant="default" />
        </div>

        <!-- Right drawer with map -->
        <ui-drawer-panel [open]="drawerOpen" side="right" (closed)="toggleDrawer()">
          <span drawerTitle class="text-sm font-semibold">Map</span>
          <ui-map-view
            [center]="mapCenter"
            [zoom]="11"
            styleUrl="https://demotiles.maplibre.org/style.json"
            ariaLabel="Operational map view"
            style="width: 100%; height: 360px; display: block;">
            @for (m of markers; track m.lng) {
              <ui-map-marker [lngLat]="m">
                <div style="width: 18px; height: 18px; background: var(--color-primary); border-radius: 50%; border: 2px solid white;"></div>
              </ui-map-marker>
            }
          </ui-map-view>
        </ui-drawer-panel>
      </div>
    `,
    moduleMetadata: {
      imports: [
        DrawerPanelComponent,
        MapViewComponent,
        MapMarkerComponent,
        HistogramTimelineComponent,
        GridComponent,
        CardComponent,
        ButtonComponent,
      ],
    },
  }),
};
