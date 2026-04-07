import type { Meta, StoryObj } from "storybook";
import { Grid, Cell } from "./grid";

const Box = ({ children }: { children: string }) => (
  <div style={{ padding: "var(--spacing-sm)", background: "var(--color-muted)", borderRadius: "var(--radius-sm)" }}>
    {children}
  </div>
);

const meta: Meta<typeof Grid> = {
  title: "Layout/Grid",
  component: Grid,
  argTypes: {
    columns: { control: "number" },
    gap: { control: "select", options: ["none", "xs", "sm", "md", "lg", "xl", "2xl"] },
  },
};

export default meta;
type Story = StoryObj<typeof Grid>;

export const ThreeColumns: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
    </Grid>
  ),
  args: { columns: 3, gap: "md" },
};

export const WithCellSpans: Story = {
  render: (args) => (
    <Grid {...args}>
      <Cell span="full"><Box>Full width</Box></Cell>
      <Cell span={2}><Box>Span 2</Box></Cell>
      <Cell><Box>Span 1</Box></Cell>
      <Cell start={2} span={2}><Box>Start at col 2, span 2</Box></Cell>
    </Grid>
  ),
  args: { columns: 3, gap: "md" },
};
