import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';
import { GridComponent } from './grid.component';

const meta: Meta<GridComponent> = {
  title: 'Layout/Grid',
  component: GridComponent,
  tags: ['autodocs'],
  argTypes: {
    cols: { control: 'select', options: [1, 2, 3, 4, 6, 12] },
    gap: { control: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'] },
  },
  render: (args) => ({
    props: args,
    template: `
      <ui-grid [cols]="cols" [gap]="gap">
        <ui-card title="Widget A">Metric summary or chart area.</ui-card>
        <ui-card title="Widget B">Metric summary or chart area.</ui-card>
        <ui-card title="Widget C">Metric summary or chart area.</ui-card>
        <ui-card title="Widget D">Metric summary or chart area.</ui-card>
      </ui-grid>
    `,
    moduleMetadata: { imports: [GridComponent, CardComponent] },
  }),
};
export default meta;

type Story = StoryObj<GridComponent>;

export const OneColumn: Story = {
  args: { cols: 1, gap: 'md' },
};

export const TwoColumns: Story = {
  args: { cols: 2, gap: 'md' },
};

export const ThreeColumns: Story = {
  args: { cols: 3, gap: 'md' },
};

export const FourColumns: Story = {
  args: { cols: 4, gap: 'sm' },
};

export const TightGrid: Story = {
  args: { cols: 3, gap: 'xs' },
};
