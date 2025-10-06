import type { Meta, StoryObj } from "@storybook/react";

import NavigationTabController from "./index";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof NavigationTabController> = {
  title: "Example/NavigationTabController",
  component: NavigationTabController,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof NavigationTabController>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    labels: ["NavigationTabController"],
  },
};

export const Default: Story = {
  args: {
    labels: ["Tab1", "Tab2", "Tab3"],
  },
};

export const Alternate: Story = {
  args: {
    labels: ["Tab1", "Tab2", "Tab3"],
  },
};
