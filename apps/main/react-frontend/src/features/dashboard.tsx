import { useMemo } from 'react';
import { Badge, HistogramTimeline, type HistogramBar, type HistogramLabel } from '@aspect/react-ui';

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function generateBars(count: number, seed: number): HistogramBar[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    value: Math.floor(rand() * 100),
  }));
}

function generateLabels(count: number, step: number): HistogramLabel[] {
  return Array.from({ length: Math.ceil(count / step) }, (_, i) => ({
    index: i * step,
    text: `${i * step}`,
  }));
}

interface StatCard { label: string; value: string; change: string; }
interface ActivityItem { message: string; time: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; }

const stats: StatCard[] = [
  { label: 'Total Users', value: '2,847', change: '+12.5%' },
  { label: 'Active Sessions', value: '423', change: '+3.2%' },
  { label: 'API Calls', value: '1.2M', change: '+8.1%' },
  { label: 'Error Rate', value: '0.03%', change: '-15.4%' },
];

const activity: ActivityItem[] = [
  { message: 'User alice@example.com registered', time: '2 min ago', variant: 'default' },
  { message: 'API rate limit warning triggered', time: '15 min ago', variant: 'destructive' },
  { message: 'Database backup completed', time: '1 hour ago', variant: 'secondary' },
  { message: 'New deployment to staging', time: '3 hours ago', variant: 'outline' },
];

const systemInfo = [
  { label: 'Uptime', value: '99.97%' },
  { label: 'Response Time', value: '142ms' },
  { label: 'Memory Usage', value: '67%' },
  { label: 'CPU Load', value: '23%' },
];

export default function Dashboard() {
  const bars = useMemo(() => generateBars(24, 42), []);
  const labels = useMemo(() => generateLabels(24, 6), []);
  const errorBars = useMemo(() => generateBars(24, 99), []);
  const errorLabels = useMemo(() => generateLabels(24, 6), []);

  return (
    <div className="p-lg flex flex-col gap-lg">
      <div className="flex items-center gap-sm">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Badge>Live</Badge>
      </div>
      <div className="grid gap-md" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className={`text-sm ${stat.change.startsWith('+') ? 'text-success' : 'text-destructive'}`}>{stat.change}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h2 className="card-title">Request Volume (24h)</h2>
          <HistogramTimeline bars={bars} labels={labels} ariaLabel="Request volume over 24 hours" />
        </div>
        <div className="card">
          <h2 className="card-title">Recent Activity</h2>
          <div className="flex flex-col gap-sm">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-sm">
                <span className="text-sm">{item.message}</span>
                <Badge variant={item.variant}>{item.time}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h2 className="card-title">Error Rate (24h)</h2>
          <HistogramTimeline bars={errorBars} labels={errorLabels} ariaLabel="Error rate over 24 hours" variant="destructive" />
        </div>
        <div className="card">
          <h2 className="card-title">System</h2>
          <div className="flex flex-col gap-sm">
            {systemInfo.map((info) => (
              <div key={info.label} className="flex justify-between">
                <span className="text-sm text-muted-foreground">{info.label}</span>
                <span className="text-sm font-bold">{info.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
