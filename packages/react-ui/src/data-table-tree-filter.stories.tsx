import type { Meta, StoryObj } from "storybook";
import { DataTableTreeFilter } from "./data-table-tree-filter";
import type { TreeFilterNode } from "./data-table-tree-filter.types";

const regionOptions: TreeFilterNode[] = [
  {
    value: "europe",
    label: "Europe",
    children: [
      { value: "france", label: "France" },
      { value: "germany", label: "Germany" },
      { value: "italy", label: "Italy" },
    ],
  },
  {
    value: "asia",
    label: "Asia",
    children: [
      { value: "japan", label: "Japan" },
      { value: "korea", label: "South Korea" },
    ],
  },
  { value: "usa", label: "United States" },
];

const meta: Meta<typeof DataTableTreeFilter> = {
  title: "Components/DataTableTreeFilter",
  component: DataTableTreeFilter,
  argTypes: {
    position: {
      control: "select",
      options: ["top", "left"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataTableTreeFilter>;

export const SingleSelect: Story = {
  args: {
    filterId: "region",
    column: "region",
    options: regionOptions,
    multi: false,
  },
};

export const MultiSelect: Story = {
  args: {
    filterId: "region",
    column: "region",
    options: regionOptions,
    multi: true,
  },
};
