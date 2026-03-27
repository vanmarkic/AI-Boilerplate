import { useMemo } from 'react';
import { Badge, HistogramTimeline, type HistogramBar, type HistogramLabel } from '@aspect/react-ui';

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function generateBars(count: number, seed: number, max = 50): HistogramBar[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    value: Math.floor(rand() * max),
  }));
}

function generateTimeLabels(count: number, step: number, startHour: number): HistogramLabel[] {
  return Array.from({ length: Math.ceil(count / step) }, (_, i) => ({
    index: i * step,
    text: `${((startHour + i * (step * 12 / count)) % 24).toString().padStart(2, '0')}:00`,
  }));
}

interface StatCard { label: string; value: string; change: string; positive: boolean; }
interface ActivityItem { action: string; detail: string; time: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; }

const stats: StatCard[] = [
  { label: 'TOTAL EVENTS', value: '14,892', change: '+12.3%', positive: true },
  { label: 'AVG LATENCY', value: '42ms', change: '-8.1%', positive: true },
  { label: 'ERROR RATE', value: '0.24%', change: '+0.03%', positive: false },
  { label: 'ACTIVE USERS', value: '1,247', change: '+5.7%', positive: true },
];

const activity: ActivityItem[] = [
  { action: 'Deployment', detail: 'frontend v2.4.1 → production', time: '2 min ago', variant: 'default' },
  { action: 'Alert resolved', detail: 'CPU spike on worker-03', time: '18 min ago', variant: 'secondary' },
  { action: 'Error spike', detail: '429 rate-limit on /api/search', time: '1h ago', variant: 'destructive' },
  { action: 'Config change', detail: 'Feature flag dark-mode enabled', time: '3h ago', variant: 'outline' },
  { action: 'Deployment', detail: 'backend v1.8.0 → staging', time: '5h ago', variant: 'default' },
];

const systemStatus = [
  { label: 'Uptime', value: '14d 7h 32m' },
  { label: 'CPU', value: '23%' },
  { label: 'Memory', value: '4.2 / 8 GB' },
  { label: 'Disk', value: '67% used' },
  { label: 'DB connections', value: '42 / 100' },
];

export default function Landing() {
  const eventBars = useMemo(() => generateBars(720, 42), []);
  const eventLabels = useMemo(() => generateTimeLabels(720, 60, 8), []);
  const errorBars = useMemo(() => generateBars(24, 99, 15), []);
  const errorLabels = useMemo(() => generateTimeLabels(24, 6, 0), []);

  return (
    <div className="p-lg flex flex-col gap-lg" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Dashboard header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Monday, March 27 2026</p>
        </div>
        <Badge variant="outline">Live</Badge>
      </div>

      {/* Stat cards */}
      <div className="grid gap-md" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-xs text-muted-foreground" style={{ letterSpacing: '0.05em' }}>{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className={`text-sm ${stat.positive ? 'text-success' : 'text-destructive'}`}>
              {stat.change} {stat.positive ? '↑' : '↓'}
            </p>
          </div>
        ))}
      </div>

      {/* Events histogram + activity */}
      <div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr', flex: 1, minHeight: 0 }}>
        <div className="card flex flex-col" style={{ minHeight: 0 }}>
          <div className="flex items-center justify-between mb-sm">
            <h3 className="card-title">Events per minute</h3>
            <Badge variant="secondary">12h window</Badge>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <HistogramTimeline bars={eventBars} labels={eventLabels} ariaLabel="Events per minute over 12 hours" />
          </div>
        </div>
        <div className="card flex flex-col" style={{ minHeight: 0 }}>
          <h3 className="card-title">Recent Activity</h3>
          <div className="flex flex-col gap-sm" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {activity.map((item, i) => (
              <div key={i} className="flex flex-col gap-xs">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{item.action}</span>
                  <Badge variant={item.variant}>{item.time}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error rate histogram + system status */}
      <div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr', flex: 1, minHeight: 0 }}>
        <div className="card flex flex-col" style={{ minHeight: 0 }}>
          <div className="flex items-center justify-between mb-sm">
            <h3 className="card-title">Error rate</h3>
            <Badge variant="destructive">3 spikes</Badge>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <HistogramTimeline bars={errorBars} labels={errorLabels} ariaLabel="Error rate over 24 hours" variant="destructive" />
          </div>
        </div>
        <div className="card flex flex-col" style={{ minHeight: 0 }}>
          <h3 className="card-title">System</h3>
          <div className="flex flex-col gap-sm" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {systemStatus.map((info) => (
              <div key={info.label} className="flex justify-between">
                <span className="text-sm text-muted-foreground">{info.label}</span>
                <span className="text-sm font-bold">{info.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-xs" style={{ marginTop: 'auto' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
              <span className="text-xs text-muted-foreground">All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
