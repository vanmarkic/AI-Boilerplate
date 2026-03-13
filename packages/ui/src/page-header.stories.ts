import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { PageHeaderComponent } from './page-header.component';

const meta: Meta<PageHeaderComponent> = {
  title: 'Layout/PageHeader',
  component: PageHeaderComponent,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
  },
  args: {
    title: 'Dashboard',
    subtitle: 'Overview of your workspace activity',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding-inline: 1.5rem">
        <ui-page-header [title]="title" [subtitle]="subtitle">
          <ui-button variant="outline" pageHeaderActions>Export</ui-button>
          <ui-button variant="default" pageHeaderActions>New Item</ui-button>
        </ui-page-header>
      </div>
    `,
    moduleMetadata: { imports: [PageHeaderComponent, ButtonComponent] },
  }),
};
export default meta;

type Story = StoryObj<PageHeaderComponent>;

export const Default: Story = {
  args: {
    title: 'Dashboard',
    subtitle: 'Overview of your workspace activity',
  },
};

export const WithoutSubtitle: Story = {
  args: {
    title: 'Analytics',
    subtitle: '',
  },
};

export const LongTitle: Story = {
  args: {
    title: 'Monthly Revenue Reports',
    subtitle: 'Compare revenue across regions, products, and time periods',
  },
};

export const NoActions: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding-inline: 1.5rem">
        <ui-page-header [title]="title" [subtitle]="subtitle" />
      </div>
    `,
    moduleMetadata: { imports: [PageHeaderComponent] },
  }),
  args: {
    title: 'Settings',
    subtitle: 'Manage your account and preferences',
  },
};
