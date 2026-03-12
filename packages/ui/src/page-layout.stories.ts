import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';
import { ButtonComponent } from './button.component';
import { CardComponent } from './card.component';
import { GridComponent } from './grid.component';
import { PageHeaderComponent } from './page-header.component';
import { PageLayoutComponent } from './page-layout.component';
import { StackComponent } from './stack.component';

const meta: Meta<PageLayoutComponent> = {
  title: 'Layout/PageLayout',
  component: PageLayoutComponent,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<PageLayoutComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <ui-page-layout>
        <div pageHeader style="padding-inline: 1.5rem; border-bottom: 1px solid var(--color-border)">
          <ui-page-header title="Dashboard" subtitle="Overview of your workspace">
            <ui-button variant="default" pageHeaderActions>New Report</ui-button>
          </ui-page-header>
        </div>
        <div style="padding: 1.5rem">
          <ui-grid [cols]="3" gap="md">
            <ui-card title="Total Users">4,320 active accounts this month.</ui-card>
            <ui-card title="Revenue">$128,400 — up 8% from last period.</ui-card>
            <ui-card title="Open Issues">12 items require attention.</ui-card>
          </ui-grid>
        </div>
        <div pageFooter style="padding: 1rem; border-top: 1px solid var(--color-border); text-align: center" class="text-sm text-muted-foreground">
          © 2025 Acme Corp
        </div>
      </ui-page-layout>
    `,
    moduleMetadata: {
      imports: [
        PageLayoutComponent,
        PageHeaderComponent,
        GridComponent,
        CardComponent,
        ButtonComponent,
        BadgeComponent,
        StackComponent,
      ],
    },
  }),
};

export const WithoutFooter: Story = {
  render: () => ({
    template: `
      <ui-page-layout>
        <div pageHeader style="padding-inline: 1.5rem; border-bottom: 1px solid var(--color-border)">
          <ui-page-header title="Analytics" subtitle="Track performance metrics" />
        </div>
        <div style="padding: 1.5rem">
          <ui-stack gap="md">
            <ui-card title="Sessions">14,820 sessions recorded this week.</ui-card>
            <ui-card title="Bounce Rate">42% average across all pages.</ui-card>
          </ui-stack>
        </div>
      </ui-page-layout>
    `,
    moduleMetadata: {
      imports: [PageLayoutComponent, PageHeaderComponent, StackComponent, CardComponent],
    },
  }),
};
