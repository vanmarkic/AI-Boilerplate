import type { Meta, StoryObj } from '@storybook/angular';
import { DashboardComponent } from './dashboard.component';

const meta: Meta<DashboardComponent> = {
  title: 'Pages/Dashboard',
  component: DashboardComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<DashboardComponent>;

export const Default: Story = {};
