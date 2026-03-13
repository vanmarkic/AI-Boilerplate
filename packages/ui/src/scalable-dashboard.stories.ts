import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';
import { CardComponent } from './card.component';
import { CardGroupComponent } from './card-group.component';
import { GridComponent } from './grid.component';
import { HistogramTimelineComponent } from './histogram-timeline.component';
import {
  GROUPS,
  buildFlatCardsTemplate,
  buildGroupsTemplate,
  generateBars,
  generateLabels,
} from './scalable-dashboard.story-data';

const sharedImports = [
  CardComponent,
  CardGroupComponent,
  GridComponent,
  HistogramTimelineComponent,
  BadgeComponent,
];

const histogramProps = {
  bars: generateBars(720, 50),
  labels: generateLabels(720, 60, (i) =>
    `${String(Math.floor(i / 60))}:${String(i % 60).padStart(2, '0')}`,
  ),
};

const dashboardShell = (content: string) => `
  <div style="min-height: 100dvh; display: flex; flex-direction: column;">
    <!-- Header -->
    <div style="
      padding: var(--spacing-sm) var(--spacing-lg);
      border-bottom: 1px solid var(--color-border);
      display: flex; align-items: center; justify-content: space-between;
    ">
      <div>
        <h1 class="text-lg font-bold text-foreground">Dashboard</h1>
        <p class="text-xs text-muted-foreground">Scalable card layout</p>
      </div>
      <ui-badge variant="outline">Live</ui-badge>
    </div>

    <!-- Scrollable content -->
    <div style="flex: 1; overflow-y: auto; padding: var(--spacing-lg);">
      <div style="display: flex; flex-direction: column; gap: var(--spacing-lg); max-width: 80rem; margin: 0 auto;">
        ${content}
      </div>
    </div>

    <!-- Histogram footer -->
    <div style="border-top: 1px solid var(--color-border); padding: var(--spacing-sm) var(--spacing-lg);">
      <ui-histogram-timeline
        [bars]="bars"
        [labels]="labels"
        ariaLabel="Events per minute (12 hours)"
        variant="default"
      />
    </div>
  </div>
`;

const meta: Meta = {
  title: 'Composed/ScalableDashboard',
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

export const FourCards: Story = {
  name: '4 Cards — Flat Grid',
  render: () => ({
    props: histogramProps,
    template: dashboardShell(buildFlatCardsTemplate(GROUPS.slice(0, 1), 4)),
    moduleMetadata: { imports: sharedImports },
  }),
};

export const SixteenCardsGrouped: Story = {
  name: '16 Cards — Grouped (aggregated)',
  render: () => ({
    props: histogramProps,
    template: dashboardShell(buildGroupsTemplate(GROUPS.slice(0, 4), 'aggregated')),
    moduleMetadata: { imports: sharedImports },
  }),
};

export const SixteenCardsExpanded: Story = {
  name: '16 Cards — Grouped (expanded)',
  render: () => ({
    props: histogramProps,
    template: dashboardShell(buildGroupsTemplate(GROUPS.slice(0, 4), 'disaggregated')),
    moduleMetadata: { imports: sharedImports },
  }),
};

export const SixteenCardsFlat: Story = {
  name: '16 Cards — Flat Grid',
  render: () => ({
    props: histogramProps,
    template: dashboardShell(buildFlatCardsTemplate(GROUPS.slice(0, 4), 4)),
    moduleMetadata: { imports: sharedImports },
  }),
};

export const FortyCardsGrouped: Story = {
  name: '40 Cards — Grouped (aggregated)',
  render: () => ({
    props: histogramProps,
    template: dashboardShell(buildGroupsTemplate(GROUPS, 'aggregated')),
    moduleMetadata: { imports: sharedImports },
  }),
};

export const FortyCardsExpanded: Story = {
  name: '40 Cards — Grouped (expanded)',
  render: () => ({
    props: histogramProps,
    template: dashboardShell(buildGroupsTemplate(GROUPS, 'disaggregated')),
    moduleMetadata: { imports: sharedImports },
  }),
};

export const FortyCardsFlat: Story = {
  name: '40 Cards — Flat Grid',
  render: () => ({
    props: histogramProps,
    template: dashboardShell(buildFlatCardsTemplate(GROUPS, 4)),
    moduleMetadata: { imports: sharedImports },
  }),
};
