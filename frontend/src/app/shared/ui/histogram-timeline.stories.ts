import type { Meta, StoryObj } from '@storybook/angular';
import { HistogramTimelineComponent } from './histogram-timeline.component';

function generateBars(count: number, maxValue: number) {
  return Array.from({ length: count }, () => ({
    value: Math.floor(Math.random() * maxValue),
  }));
}

function generateLabels(barCount: number, interval: number, formatter: (i: number) => string) {
  const labels = [];
  for (let i = 0; i < barCount; i += interval) {
    labels.push({ index: i, text: formatter(i) });
  }
  return labels;
}

const meta: Meta<HistogramTimelineComponent> = {
  title: 'UI/HistogramTimeline',
  component: HistogramTimelineComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'success', 'destructive', 'muted'] },
  },
};
export default meta;

type Story = StoryObj<HistogramTimelineComponent>;

export const Default: Story = {
  args: {
    bars: generateBars(60, 20),
    labels: generateLabels(60, 10, i => `${String(i)}m`),
    ariaLabel: 'Events per minute (1 hour)',
    variant: 'default',
  },
};

export const Dense720Bars: Story = {
  args: {
    bars: generateBars(720, 50),
    labels: generateLabels(720, 60, i => `${String(Math.floor(i / 60))}:${String(i % 60).padStart(2, '0')}`),
    ariaLabel: 'Events per minute (12 hours)',
    variant: 'default',
  },
};

export const Success: Story = {
  args: {
    bars: generateBars(30, 100),
    labels: generateLabels(30, 5, i => `Day ${String(i + 1)}`),
    ariaLabel: 'Successful deployments per day',
    variant: 'success',
  },
};

export const Destructive: Story = {
  args: {
    bars: generateBars(24, 15),
    labels: generateLabels(24, 4, i => `${String(i)}:00`),
    ariaLabel: 'Errors per hour',
    variant: 'destructive',
  },
};

export const Muted: Story = {
  args: {
    bars: generateBars(90, 30),
    labels: generateLabels(90, 15, i => `${String(i)}d`),
    ariaLabel: 'Background activity (90 days)',
    variant: 'muted',
  },
};
