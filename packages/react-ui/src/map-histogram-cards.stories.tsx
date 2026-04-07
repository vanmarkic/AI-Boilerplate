import { useState } from 'react';
import type { Meta, StoryObj } from 'storybook';
import { Button } from './button';
import { Card } from './card';
import { DrawerPanel } from './drawer-panel';
import { Grid } from './grid';
import { HistogramTimeline } from './histogram-timeline';
import { MapMarker } from './map-marker';
import { MapView } from './map-view';

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

function generateLabels(barCount: number, interval: number, formatter: (i: number) => string) {
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

const bars = generateBars(720, 50);
const labels = generateLabels(
  720,
  60,
  (i) => `${String(Math.floor(i / 60))}:${String(i % 60).padStart(2, '0')}`,
);

const markers = [
  { lng: -122.42, lat: 37.77 },
  { lng: -122.4, lat: 37.79 },
  { lng: -122.44, lat: 37.76 },
  { lng: -122.38, lat: 37.78 },
];

const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';

function MapHistogramCardsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar with map toggle */}
      <div
        style={{
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="outline" onClick={() => setDrawerOpen((o) => !o)}>
          {drawerOpen ? 'Hide Map' : 'Show Map'}
        </Button>
      </div>

      {/* Main content: 4 groups of 4 cards */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 'var(--spacing-lg)',
        }}
      >
        <Grid columns={2} gap="md">
          {CARD_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold" style={{ marginBottom: 'var(--spacing-sm)' }}>
                {group.title}
              </p>
              <Grid columns={2} gap="sm">
                {group.cards.map((c) => (
                  <Card key={c.title} title={c.title}>
                    {c.body}
                  </Card>
                ))}
              </Grid>
            </div>
          ))}
        </Grid>
      </div>

      {/* Bottom: histogram with 720 bars */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
        }}
      >
        <HistogramTimeline
          bars={bars}
          labels={labels}
          ariaLabel="Events per minute (12 hours)"
          variant="default"
        />
      </div>

      {/* Right drawer with map */}
      <DrawerPanel
        open={drawerOpen}
        side="right"
        onClose={() => setDrawerOpen(false)}
        title={<span className="text-sm font-semibold">Map</span>}
      >
        <MapView
          center={{ lng: -122.42, lat: 37.77 }}
          zoom={11}
          styleUrl={DEMO_STYLE}
          ariaLabel="Operational map view"
        >
          {markers.map((m) => (
            <MapMarker key={`${m.lng}-${m.lat}`} lngLat={m}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  background: 'var(--color-primary)',
                  borderRadius: '50%',
                  border: '2px solid white',
                }}
              />
            </MapMarker>
          ))}
        </MapView>
      </DrawerPanel>
    </div>
  );
}

const meta: Meta = {
  title: 'Composed/MapHistogramCards',
  tags: ['!test'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => <MapHistogramCardsPage />,
};
