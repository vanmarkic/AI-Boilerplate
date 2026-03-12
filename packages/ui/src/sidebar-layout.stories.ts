import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';
import { ButtonComponent } from './button.component';
import { CardComponent } from './card.component';
import { GridComponent } from './grid.component';
import { PageHeaderComponent } from './page-header.component';
import { SidebarLayoutComponent } from './sidebar-layout.component';
import { StackComponent } from './stack.component';

const meta: Meta<SidebarLayoutComponent> = {
  title: 'Layout/SidebarLayout',
  component: SidebarLayoutComponent,
  tags: ['autodocs'],
  argTypes: {
    side: { control: 'select', options: ['left', 'right'] },
  },
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<SidebarLayoutComponent>;

const NAV_ITEMS = ['Dashboard', 'Analytics', 'Reports', 'Settings'];
const navLinks = NAV_ITEMS.map((n) => `<a style="padding: 0.5rem 1rem; display:block; border-radius:4px; cursor:pointer">${n}</a>`).join('');

export const LeftSidebar: Story = {
  render: () => ({
    template: `
      <div style="height: 100dvh">
        <ui-sidebar-layout side="left">
          <nav sidebar style="padding: 1rem; border-right: 1px solid var(--color-border); height: 100%">
            <ui-stack gap="xs">
              ${navLinks}
            </ui-stack>
          </nav>
          <div style="padding: 1.5rem">
            <ui-page-header title="Dashboard" subtitle="Your workspace overview">
              <ui-button variant="outline" pageHeaderActions>Export</ui-button>
            </ui-page-header>
            <ui-grid [cols]="2" gap="md">
              <ui-card title="Active Projects">23 projects in progress.</ui-card>
              <ui-card title="Team Members">8 contributors active today.</ui-card>
            </ui-grid>
          </div>
        </ui-sidebar-layout>
      </div>
    `,
    moduleMetadata: {
      imports: [
        SidebarLayoutComponent,
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

export const RightSidebar: Story = {
  render: () => ({
    template: `
      <div style="height: 100dvh">
        <ui-sidebar-layout side="right">
          <div style="padding: 1.5rem">
            <ui-page-header title="Reports" />
            <ui-stack gap="md">
              <ui-card title="Q1 Summary">Revenue exceeded targets by 14%.</ui-card>
              <ui-card title="Q2 Forecast">Projected growth of 9% based on current pipeline.</ui-card>
            </ui-stack>
          </div>
          <aside sidebar style="padding: 1rem; border-left: 1px solid var(--color-border)">
            <ui-stack gap="sm">
              <p class="text-sm font-semibold">Filters</p>
              <p class="text-sm text-muted-foreground">Quarter</p>
              <p class="text-sm text-muted-foreground">Region</p>
              <p class="text-sm text-muted-foreground">Product</p>
            </ui-stack>
          </aside>
        </ui-sidebar-layout>
      </div>
    `,
    moduleMetadata: {
      imports: [SidebarLayoutComponent, PageHeaderComponent, StackComponent, CardComponent],
    },
  }),
};
