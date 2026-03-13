import type { Meta, StoryObj } from '@storybook/angular';
import { DrawerPanelComponent } from './drawer-panel.component';
import { CardComponent } from './card.component';
import { StackComponent } from './stack.component';

const meta: Meta<DrawerPanelComponent> = {
  title: 'UI/DrawerPanel',
  component: DrawerPanelComponent,
  tags: ['autodocs'],
  argTypes: {
    side: { control: 'select', options: ['left', 'right'] },
    open: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<DrawerPanelComponent>;

export const Right: Story = {
  render: (args) => ({
    props: { ...args, onClose: () => {} },
    template: `
      <ui-drawer-panel [open]="open" [side]="side" (closed)="onClose()">
        <span drawerTitle class="text-sm font-semibold">Details</span>
        <ui-stack gap="sm">
          <ui-card title="Location">San Francisco, CA</ui-card>
          <ui-card title="Status">All systems operational.</ui-card>
        </ui-stack>
      </ui-drawer-panel>
    `,
    moduleMetadata: {
      imports: [DrawerPanelComponent, CardComponent, StackComponent],
    },
  }),
  args: { open: true, side: 'right' },
};

export const Left: Story = {
  render: (args) => ({
    props: { ...args, onClose: () => {} },
    template: `
      <ui-drawer-panel [open]="open" [side]="side" (closed)="onClose()">
        <span drawerTitle class="text-sm font-semibold">Navigation</span>
        <ui-stack gap="xs">
          <a style="display:block; padding: 0.5rem 0; cursor:pointer">Dashboard</a>
          <a style="display:block; padding: 0.5rem 0; cursor:pointer">Analytics</a>
          <a style="display:block; padding: 0.5rem 0; cursor:pointer">Reports</a>
          <a style="display:block; padding: 0.5rem 0; cursor:pointer">Settings</a>
        </ui-stack>
      </ui-drawer-panel>
    `,
    moduleMetadata: {
      imports: [DrawerPanelComponent, StackComponent],
    },
  }),
  args: { open: true, side: 'left' },
};

export const Closed: Story = {
  render: (args) => ({
    props: { ...args, onClose: () => {} },
    template: `
      <ui-drawer-panel [open]="open" [side]="side" (closed)="onClose()">
        <span drawerTitle class="text-sm font-semibold">Hidden Panel</span>
        <p>This content is off-screen.</p>
      </ui-drawer-panel>
    `,
    moduleMetadata: { imports: [DrawerPanelComponent] },
  }),
  args: { open: false, side: 'right' },
};
