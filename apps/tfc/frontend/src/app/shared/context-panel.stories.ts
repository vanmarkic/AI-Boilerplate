import type { Meta, StoryObj } from "@storybook/angular";
import { ContextPanelComponent } from "./context-panel.component";

const meta: Meta<ContextPanelComponent> = {
  title: "TFC/ContextPanel",
  component: ContextPanelComponent,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    briefing: { control: "text" },
  },
  render: (args) => ({
    props: args,
    template: `
      <tfc-context-panel
        [title]="title"
        [briefing]="briefing"
        [objectives]="objectives"
        [rules]="rules"
      ></tfc-context-panel>
    `,
    moduleMetadata: { imports: [ContextPanelComponent] },
  }),
};
export default meta;

type Story = StoryObj<
  ContextPanelComponent & { objectives: string[]; rules: string[] }
>;

export const Default: Story = {
  args: {
    title: "Scenario Context",
    briefing:
      "A humanitarian crisis has developed in the eastern region. Displaced populations are moving westward and require immediate assistance. Local infrastructure is severely damaged.",
    objectives: [
      "Establish a forward operating base within 48 hours",
      "Coordinate with local authorities for aid distribution",
      "Secure primary supply routes",
    ],
    rules: [
      "All operations must comply with international humanitarian law",
      "Minimum force posture at all times",
      "Report status every 6 hours",
    ],
  },
};

export const BriefingOnly: Story = {
  args: {
    title: "Intelligence Brief",
    briefing:
      "Satellite imagery confirms increased activity at the northern checkpoint. Weather conditions are expected to deteriorate over the next 24 hours with heavy rainfall and reduced visibility.",
    objectives: [],
    rules: [],
  },
};

export const ObjectivesOnly: Story = {
  args: {
    title: "Mission Objectives",
    briefing: "",
    objectives: [
      "Secure the perimeter of the designated area",
      "Establish communication relay points",
      "Complete assessment of local resource availability",
      "Prepare contingency evacuation routes",
    ],
    rules: [],
  },
};
