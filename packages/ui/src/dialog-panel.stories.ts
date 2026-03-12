import type { Meta, StoryObj } from '@storybook/angular';
import { DialogPanelComponent } from './dialog-panel.component';
import { ButtonComponent } from './button.component';

interface DialogArgs {
  variant: 'default' | 'destructive';
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
}

const meta: Meta<DialogArgs> = {
  title: 'UI/DialogPanel',
  component: DialogPanelComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive'] },
    title: { control: 'text' },
    body: { control: 'text' },
    cancelLabel: { control: 'text' },
    confirmLabel: { control: 'text' },
  },
  args: {
    variant: 'default',
    title: 'Dialog Title',
    body: 'This is the dialog body content. It can contain any content.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Confirm',
  },
  render: (args) => ({
    props: args,
    template: `
      <app-dialog-panel [variant]="variant">
        <span dialogTitle>{{ title }}</span>
        <p>{{ body }}</p>
        <ng-container dialogFooter>
          <app-button variant="outline">{{ cancelLabel }}</app-button>
          <app-button [variant]="variant === 'destructive' ? 'destructive' : 'default'">{{ confirmLabel }}</app-button>
        </ng-container>
      </app-dialog-panel>
    `,
    moduleMetadata: { imports: [DialogPanelComponent, ButtonComponent] },
  }),
};
export default meta;

type Story = StoryObj<DialogArgs>;

export const Default: Story = {
  args: {
    variant: 'default',
    title: 'Save Changes',
    body: 'You have unsaved changes. Would you like to save them before leaving?',
    cancelLabel: 'Discard',
    confirmLabel: 'Save',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    title: 'Delete Item',
    body: 'This action cannot be undone. All data will be permanently removed.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Delete',
  },
};
