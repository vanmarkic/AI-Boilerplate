import type { ReactNode } from 'react';
import type { HistogramBar, HistogramLabel } from './histogram-timeline';
import { Card } from './card';
import { CardGroup, type CardGroupMode } from './card-group';
import { Grid } from './grid';

export interface CardDef {
  title: string;
  body: string;
}

export interface GroupDef {
  title: string;
  cards: CardDef[];
  summary: string;
}

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function generateBars(count: number, maxValue: number, seed = 42): HistogramBar[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    value: Math.floor(rand() * maxValue),
  }));
}

export function generateLabels(
  barCount: number,
  interval: number,
  formatter: (i: number) => string,
): HistogramLabel[] {
  const labels: HistogramLabel[] = [];
  for (let i = 0; i < barCount; i += interval) {
    labels.push({ index: i, text: formatter(i) });
  }
  return labels;
}

export const GROUPS: GroupDef[] = [
  {
    title: 'Infrastructure',
    summary: '4 metrics — all within normal range',
    cards: [
      { title: 'CPU Usage', body: '72% average across 12 nodes.' },
      { title: 'Memory', body: '48 GB / 64 GB allocated.' },
      { title: 'Disk I/O', body: '1,240 IOPS — within normal range.' },
      { title: 'Network', body: '320 Mbps throughput, 0.2% packet loss.' },
    ],
  },
  {
    title: 'Application',
    summary: '4 metrics — 1 warning on error rate',
    cards: [
      { title: 'Requests', body: '14,820 req/min — up 6% from baseline.' },
      { title: 'Latency P99', body: '142 ms — under 200 ms SLA target.' },
      { title: 'Error Rate', body: '0.03% — 12 errors in the last hour.' },
      { title: 'Uptime', body: '99.98% over the last 30 days.' },
    ],
  },
  {
    title: 'Security',
    summary: '4 metrics — 1 certificate alert',
    cards: [
      { title: 'Auth Failures', body: '7 failed login attempts today.' },
      { title: 'Active Sessions', body: '482 concurrent user sessions.' },
      { title: 'TLS Certs', body: '3 certificates expiring in 14 days.' },
      { title: 'Audit Events', body: '1,892 events logged this hour.' },
    ],
  },
  {
    title: 'Deployment',
    summary: '4 metrics — pipeline healthy',
    cards: [
      { title: 'Last Deploy', body: 'v2.14.3 deployed 42 minutes ago.' },
      { title: 'Pipeline', body: '3 builds queued, 1 running.' },
      { title: 'Rollbacks', body: '0 rollbacks in the last 7 days.' },
      { title: 'Coverage', body: '87.4% line coverage on main branch.' },
    ],
  },
  {
    title: 'Database',
    summary: '4 metrics — all healthy',
    cards: [
      { title: 'Connections', body: '42 / 100 active connections.' },
      { title: 'Query Time', body: 'P95 query duration: 18 ms.' },
      { title: 'Replication Lag', body: '120 ms — within 500 ms target.' },
      { title: 'Cache Hit Rate', body: '98.7% — buffer pool optimized.' },
    ],
  },
  {
    title: 'CDN & Edge',
    summary: '4 metrics — cache performance nominal',
    cards: [
      { title: 'Cache Hit', body: '94.2% hit rate across edge nodes.' },
      { title: 'Bandwidth', body: '1.8 TB served in the last hour.' },
      { title: 'Edge Latency', body: '12 ms average first-byte time.' },
      { title: 'Origin Pulls', body: '342 origin requests this hour.' },
    ],
  },
  {
    title: 'Messaging',
    summary: '4 metrics — consumer lag on 1 topic',
    cards: [
      { title: 'Queue Depth', body: '1,247 messages pending.' },
      { title: 'Throughput', body: '8,400 msg/sec processed.' },
      { title: 'Consumer Lag', body: '2,100 messages behind on events.' },
      { title: 'Dead Letters', body: '3 messages in DLQ.' },
    ],
  },
  {
    title: 'Observability',
    summary: '4 metrics — ingestion nominal',
    cards: [
      { title: 'Log Volume', body: '12 GB ingested this hour.' },
      { title: 'Trace Spans', body: '2.4M spans sampled at 10%.' },
      { title: 'Alerts Active', body: '2 firing, 14 silenced.' },
      { title: 'Dashboards', body: '18 dashboards, 4 viewed today.' },
    ],
  },
  {
    title: 'Cost & Billing',
    summary: '4 metrics — within budget',
    cards: [
      { title: 'Daily Spend', body: '$142.30 — 3% under forecast.' },
      { title: 'Compute', body: '$98.50 across 24 instances.' },
      { title: 'Storage', body: '$28.40 for 4.2 TB stored.' },
      { title: 'Data Transfer', body: '$15.40 for 2.1 TB egress.' },
    ],
  },
  {
    title: 'Compliance',
    summary: '4 metrics — 1 policy pending review',
    cards: [
      { title: 'Policy Checks', body: '47 / 48 policies passing.' },
      { title: 'Data Residency', body: 'All data in eu-west-1 region.' },
      { title: 'Access Reviews', body: '3 reviews due this week.' },
      { title: 'Encryption', body: '100% at-rest encryption coverage.' },
    ],
  },
];

export function FlatCards({ groups, cols = 4 }: { groups: GroupDef[]; cols?: number }): ReactNode {
  const allCards = groups.flatMap((g) => g.cards);
  return (
    <Grid columns={cols} gap="md">
      {allCards.map((c) => (
        <Card key={c.title} title={c.title}>{c.body}</Card>
      ))}
    </Grid>
  );
}

export function GroupedCards({
  groups,
  defaultMode = 'aggregated',
}: {
  groups: GroupDef[];
  defaultMode?: CardGroupMode;
}): ReactNode {
  return (
    <>
      {groups.map((g) => (
        <CardGroup
          key={g.title}
          title={g.title}
          count={g.cards.length}
          mode={defaultMode}
          summary={<span>{g.summary}</span>}
        >
          {g.cards.map((c) => (
            <Card key={c.title} title={c.title}>{c.body}</Card>
          ))}
        </CardGroup>
      ))}
    </>
  );
}
