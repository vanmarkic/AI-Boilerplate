import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';
import { CardGroupComponent } from './card-group.component';

const meta: Meta<CardGroupComponent> = {
  title: 'UI/CardGroup',
  component: CardGroupComponent,
  argTypes: {
    mode: { control: 'radio', options: ['aggregated', 'disaggregated'] },
  },
};
export default meta;

type Story = StoryObj<CardGroupComponent>;

export const Aggregated: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-card-group title="Infrastructure" [count]="4" [mode]="'aggregated'">
        <span groupSummary>4 metrics — all within normal range</span>
        <ui-card title="CPU Usage">72% average across 12 nodes.</ui-card>
        <ui-card title="Memory">48 GB / 64 GB allocated.</ui-card>
        <ui-card title="Disk I/O">1,240 IOPS — normal.</ui-card>
        <ui-card title="Network">320 Mbps, 0.2% packet loss.</ui-card>
      </ui-card-group>
    `,
    moduleMetadata: { imports: [CardGroupComponent, CardComponent] },
  }),
};

export const Disaggregated: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-card-group title="Infrastructure" [count]="4" [mode]="'disaggregated'">
        <span groupSummary>4 metrics — all within normal range</span>
        <ui-card title="CPU Usage">72% average across 12 nodes.</ui-card>
        <ui-card title="Memory">48 GB / 64 GB allocated.</ui-card>
        <ui-card title="Disk I/O">1,240 IOPS — normal.</ui-card>
        <ui-card title="Network">320 Mbps, 0.2% packet loss.</ui-card>
      </ui-card-group>
    `,
    moduleMetadata: { imports: [CardGroupComponent, CardComponent] },
  }),
};

export const MultipleGroups: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; gap: var(--spacing-md); max-width: 48rem;">
        <ui-card-group title="Infrastructure" [count]="4" [mode]="'aggregated'">
          <span groupSummary>4 metrics — all within normal range</span>
          <ui-card title="CPU Usage">72% average across 12 nodes.</ui-card>
          <ui-card title="Memory">48 GB / 64 GB allocated.</ui-card>
          <ui-card title="Disk I/O">1,240 IOPS — normal.</ui-card>
          <ui-card title="Network">320 Mbps, 0.2% packet loss.</ui-card>
        </ui-card-group>
        <ui-card-group title="Application" [count]="4" [mode]="'disaggregated'">
          <span groupSummary>4 metrics — 1 warning</span>
          <ui-card title="Requests">14,820 req/min — up 6%.</ui-card>
          <ui-card title="Latency P99">142 ms — under SLA.</ui-card>
          <ui-card title="Error Rate">0.03% — 12 errors/hr.</ui-card>
          <ui-card title="Uptime">99.98% over 30 days.</ui-card>
        </ui-card-group>
        <ui-card-group title="Security" [count]="3" [mode]="'aggregated'">
          <span groupSummary>3 metrics — 1 certificate expiring soon</span>
          <ui-card title="Auth Failures">7 failed logins today.</ui-card>
          <ui-card title="Active Sessions">482 concurrent sessions.</ui-card>
          <ui-card title="TLS Certs">3 certs expiring in 14 days.</ui-card>
        </ui-card-group>
      </div>
    `,
    moduleMetadata: { imports: [CardGroupComponent, CardComponent] },
  }),
};
