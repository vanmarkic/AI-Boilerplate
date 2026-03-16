import type { Meta, StoryObj } from '@storybook/angular';
import { TabNavComponent } from './tab-nav.component';
import { TabLinkDirective } from './tab-link.directive';

const meta: Meta<TabNavComponent> = {
  title: 'Navigation/TabNav',
  component: TabNavComponent,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<TabNavComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <ui-tab-nav>
        <a uiTabLink class="tab-active">Permissions</a>
        <a uiTabLink>Users</a>
        <a uiTabLink>Settings</a>
      </ui-tab-nav>
    `,
    moduleMetadata: { imports: [TabNavComponent, TabLinkDirective] },
  }),
};

export const TwoTabs: Story = {
  render: () => ({
    template: `
      <ui-tab-nav>
        <a uiTabLink class="tab-active">Overview</a>
        <a uiTabLink>Details</a>
      </ui-tab-nav>
    `,
    moduleMetadata: { imports: [TabNavComponent, TabLinkDirective] },
  }),
};

export const NoActiveTab: Story = {
  render: () => ({
    template: `
      <ui-tab-nav>
        <a uiTabLink>First</a>
        <a uiTabLink>Second</a>
        <a uiTabLink>Third</a>
      </ui-tab-nav>
    `,
    moduleMetadata: { imports: [TabNavComponent, TabLinkDirective] },
  }),
};
