import type { Meta, StoryObj } from '@storybook/angular';
import { DecisionPanelComponent, type DecisionOption } from './decision-panel.component';

interface DecisionPanelArgs {
  title: string;
  description: string;
  questionType: string;
  options: DecisionOption[];
}

const meta: Meta<DecisionPanelArgs> = {
  title: 'TFC/DecisionPanel',
  component: DecisionPanelComponent,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    questionType: { control: 'select', options: ['single_choice', 'multi_choice', 'free_text'] },
  },
  args: {
    title: 'Decision Point',
    description: 'Choose your response to the current situation.',
    questionType: 'single_choice',
    options: [
      { id: 'opt-1', label: 'Option A' },
      { id: 'opt-2', label: 'Option B' },
      { id: 'opt-3', label: 'Option C' },
    ],
  },
  render: (args) => ({
    props: args,
    template: `
      <tfc-decision-panel
        [title]="title"
        [description]="description"
        [questionType]="questionType"
        [options]="options"
      ></tfc-decision-panel>
    `,
    moduleMetadata: { imports: [DecisionPanelComponent] },
  }),
};
export default meta;

type Story = StoryObj<DecisionPanelArgs>;

export const SingleChoice: Story = {
  args: {
    title: 'Select a Course of Action',
    description: 'Based on the current intelligence, choose the best approach.',
    questionType: 'single_choice',
    options: [
      { id: 'engage', label: 'Engage directly' },
      { id: 'flank', label: 'Flank from the east' },
      { id: 'hold', label: 'Hold position and observe' },
    ],
  },
};

export const MultipleChoice: Story = {
  args: {
    title: 'Select Resources to Deploy',
    description: 'You may choose multiple resources for this operation.',
    questionType: 'multi_choice',
    options: [
      { id: 'recon', label: 'Reconnaissance team' },
      { id: 'medic', label: 'Medical support' },
      { id: 'logistics', label: 'Logistics convoy' },
      { id: 'air', label: 'Air support' },
    ],
  },
};

export const FreeText: Story = {
  args: {
    title: 'Provide Your Assessment',
    description: 'Describe your reasoning for the recommended approach.',
    questionType: 'free_text',
    options: [],
  },
};
