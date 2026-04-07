import type { Meta, StoryObj } from "storybook";
import { HistogramTimeline } from "./histogram-timeline";
import type { HistogramBar, HistogramLabel } from "./histogram-timeline";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function generateBars(count: number, seed = 42): HistogramBar[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({ value: Math.floor(rand() * 100) }));
}

function generateLabels(count: number, step: number): HistogramLabel[] {
  return Array.from({ length: Math.ceil(count / step) }, (_, i) => ({
    index: i * step,
    text: `T${i * step}`,
  }));
}

const meta: Meta<typeof HistogramTimeline> = {
  title: "Components/HistogramTimeline",
  component: HistogramTimeline,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "destructive", "muted"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof HistogramTimeline>;

const bars24 = generateBars(24);
const labels24 = generateLabels(24, 6);

export const Default: Story = {
  args: {
    bars: bars24,
    labels: labels24,
    ariaLabel: "24-hour activity histogram",
  },
};

export const Success: Story = {
  args: {
    bars: bars24,
    labels: labels24,
    ariaLabel: "Success histogram",
    variant: "success",
  },
};

export const Dense: Story = {
  args: {
    bars: generateBars(720, 99),
    labels: generateLabels(720, 120),
    ariaLabel: "Dense 720-bar histogram",
    variant: "muted",
  },
};
