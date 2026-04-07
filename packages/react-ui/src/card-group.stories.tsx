import type { Meta, StoryObj } from 'storybook';
import { CardGroup } from './card-group';
import { Card } from './card';

const meta: Meta<typeof CardGroup> = {
  title: 'Components/CardGroup',
  component: CardGroup,
  argTypes: {
    mode: {
      control: 'select',
      options: ['aggregated', 'disaggregated'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof CardGroup>;

export const Aggregated: Story = {
  args: {
    title: 'Infrastructure',
    count: 4,
    mode: 'aggregated',
    summary: <span>4 metrics — all within normal range</span>,
    children: (
      <>
        <Card title="CPU Usage">72% average across 12 nodes.</Card>
        <Card title="Memory">48 GB / 64 GB allocated.</Card>
        <Card title="Disk I/O">1,240 IOPS — normal.</Card>
        <Card title="Network">320 Mbps, 0.2% packet loss.</Card>
      </>
    ),
  },
};

export const Disaggregated: Story = {
  args: {
    title: 'Infrastructure',
    count: 4,
    mode: 'disaggregated',
    summary: <span>4 metrics — all within normal range</span>,
    children: (
      <>
        <Card title="CPU Usage">72% average across 12 nodes.</Card>
        <Card title="Memory">48 GB / 64 GB allocated.</Card>
        <Card title="Disk I/O">1,240 IOPS — normal.</Card>
        <Card title="Network">320 Mbps, 0.2% packet loss.</Card>
      </>
    ),
  },
};

export const MultipleGroups: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        maxWidth: '48rem',
      }}
    >
      <CardGroup
        title="Infrastructure"
        count={4}
        summary={<span>4 metrics — all within normal range</span>}
      >
        <Card title="CPU Usage">72% average across 12 nodes.</Card>
        <Card title="Memory">48 GB / 64 GB allocated.</Card>
        <Card title="Disk I/O">1,240 IOPS — normal.</Card>
        <Card title="Network">320 Mbps, 0.2% packet loss.</Card>
      </CardGroup>
      <CardGroup
        title="Application"
        count={4}
        mode="disaggregated"
        summary={<span>4 metrics — 1 warning</span>}
      >
        <Card title="Requests">14,820 req/min — up 6%.</Card>
        <Card title="Latency P99">142 ms — under SLA.</Card>
        <Card title="Error Rate">0.03% — 12 errors/hr.</Card>
        <Card title="Uptime">99.98% over 30 days.</Card>
      </CardGroup>
      <CardGroup
        title="Security"
        count={3}
        summary={<span>3 metrics — 1 certificate expiring soon</span>}
      >
        <Card title="Auth Failures">7 failed logins today.</Card>
        <Card title="Active Sessions">482 concurrent sessions.</Card>
        <Card title="TLS Certs">3 certs expiring in 14 days.</Card>
      </CardGroup>
    </div>
  ),
};
