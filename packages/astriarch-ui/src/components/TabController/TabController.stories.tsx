import type { Meta, StoryObj } from "@storybook/react-webpack5";

import TabController from "./index";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof TabController> = {
  title: "Example/TabController",
  component: TabController,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof TabController>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    tabs: [{ label: "TabController" }],
  },
};

const children1 = <p>Test Panel Content 1</p>;
const children2 = <p>Test Panel Content 2</p>;
const children3 = <p>Test Panel Content 3</p>;

export const Large: Story = {
  args: {
    size: "lg",
    tabs: [
      { label: "Large", children: children1 },
      { label: "Tab1", children: children2 },
      { label: "Tab2", children: children3 },
    ],
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    tabs: [
      { label: "Medium", children: children1 },
      { label: "Tab", children: children2 },
    ],
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    tabs: [
      { label: "Small", children: children1 },
      { label: "Tab", children: children2 },
    ],
  },
};
