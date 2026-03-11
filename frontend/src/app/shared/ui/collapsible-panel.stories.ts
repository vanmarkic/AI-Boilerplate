import type { Meta, StoryObj } from '@storybook/angular';
import { CollapsiblePanelComponent } from './collapsible-panel.component';
import { BadgeComponent } from './badge.component';

const meta: Meta<CollapsiblePanelComponent> = {
  title: 'UI/CollapsiblePanel',
  component: CollapsiblePanelComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'ghost', 'outline'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
    open: { control: 'boolean' },
  },
  render: (args) => ({
    props: args,
    template: `
      <app-collapsible-panel [variant]="variant" [size]="size" [open]="open">
        <span panelTitle>Panel Title</span>
        <p>This is the panel content. It can contain any kind of content — text, forms, images, or other components.</p>
      </app-collapsible-panel>
    `,
    moduleMetadata: { imports: [CollapsiblePanelComponent] },
  }),
};
export default meta;

type Story = StoryObj<CollapsiblePanelComponent>;

export const Default: Story = {
  args: { variant: 'default', size: 'default', open: false },
};

export const Open: Story = {
  args: { variant: 'default', size: 'default', open: true },
};

export const Ghost: Story = {
  args: { variant: 'ghost', open: true },
};

export const Outline: Story = {
  args: { variant: 'outline', open: true },
};

export const Small: Story = {
  args: { size: 'sm', open: true },
};

export const Large: Story = {
  args: { size: 'lg', open: true },
};

export const AccordionGroup: StoryObj = {
  render: () => ({
    template: `
      <div>
        <app-collapsible-panel [open]="true">
          <span panelTitle>Getting Started</span>
          <p>Welcome to the platform. This section covers the basics of setting up your account and navigating the dashboard.</p>
        </app-collapsible-panel>
        <app-collapsible-panel>
          <span panelTitle>Configuration</span>
          <p>Customize your workspace by adjusting notification preferences, theme settings, and integration options.</p>
        </app-collapsible-panel>
        <app-collapsible-panel>
          <span panelTitle>Advanced Settings</span>
          <p>Fine-tune performance, manage API keys, and configure deployment pipelines for your projects.</p>
        </app-collapsible-panel>
      </div>
    `,
    moduleMetadata: { imports: [CollapsiblePanelComponent] },
  }),
};

export const RichContent: StoryObj = {
  render: () => ({
    template: `
      <app-collapsible-panel [open]="true">
        <span panelTitle class="flex items-center gap-sm">
          System Status
          <app-badge variant="secondary">Live</app-badge>
        </span>
        <div class="flex flex-col gap-sm">
          <div class="flex justify-between">
            <span>API Server</span>
            <span class="text-primary">Operational</span>
          </div>
          <div class="flex justify-between">
            <span>Database</span>
            <span class="text-primary">Operational</span>
          </div>
          <div class="flex justify-between">
            <span>CDN</span>
            <span class="text-destructive">Degraded</span>
          </div>
        </div>
      </app-collapsible-panel>
    `,
    moduleMetadata: { imports: [CollapsiblePanelComponent, BadgeComponent] },
  }),
};

export const NestedPanels: StoryObj = {
  render: () => ({
    template: `
      <app-collapsible-panel [open]="true" variant="outline">
        <span panelTitle>Frontend</span>
        <div class="flex flex-col gap-sm">
          <app-collapsible-panel variant="ghost" size="sm" [open]="true">
            <span panelTitle>Components</span>
            <p>Shared UI components built with Angular signals and the design system.</p>
          </app-collapsible-panel>
          <app-collapsible-panel variant="ghost" size="sm">
            <span panelTitle>Services</span>
            <p>Core services for authentication, state management, and API communication.</p>
          </app-collapsible-panel>
        </div>
      </app-collapsible-panel>
    `,
    moduleMetadata: { imports: [CollapsiblePanelComponent] },
  }),
};
