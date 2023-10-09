import type { Meta, StoryObj } from "@storybook/react";

import Notification from "./index";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Notification> = {
  title: "Example/Notification",
  component: Notification,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof Notification>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    label: "Building 1 mine on planet H6",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    label: "Large Notification",
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    label: "Medium Notification",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    label: "Small Notification",
  },
};
