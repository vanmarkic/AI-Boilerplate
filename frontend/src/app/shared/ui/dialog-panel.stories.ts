import type { Meta, StoryObj } from '@storybook/angular';
import { DialogPanelComponent } from './dialog-panel.component';
import { ButtonComponent } from './button.component';

const meta: Meta<DialogPanelComponent> = {
  title: 'UI/DialogPanel',
  component: DialogPanelComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive'] },
  },
  render: (args) => ({
    props: args,
    template: `
      <app-dialog-panel [variant]="variant">
        <span dialogTitle>Dialog Title</span>
        <p>This is the dialog body content. It can contain any content.</p>
        <ng-container dialogFooter>
          <app-button variant="outline">Cancel</app-button>
          <app-button>Confirm</app-button>
        </ng-container>
      </app-dialog-panel>
    `,
    moduleMetadata: { imports: [DialogPanelComponent, ButtonComponent] },
  }),
};
export default meta;

type Story = StoryObj<DialogPanelComponent>;

export const Default: Story = { args: { variant: 'default' } };

export const Destructive: Story = {
  args: { variant: 'destructive' },
  render: (args) => ({
    props: args,
    template: `
      <app-dialog-panel variant="destructive">
        <span dialogTitle>Delete Item</span>
        <p>This action cannot be undone. All data will be permanently removed.</p>
        <ng-container dialogFooter>
          <app-button variant="outline">Cancel</app-button>
          <app-button variant="destructive">Delete</app-button>
        </ng-container>
      </app-dialog-panel>
    `,
    moduleMetadata: { imports: [DialogPanelComponent, ButtonComponent] },
  }),
};
