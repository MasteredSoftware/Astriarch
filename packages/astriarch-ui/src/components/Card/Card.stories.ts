import type { Meta, StoryObj } from "@storybook/react-webpack5";

import Card from "./index";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Card> = {
  title: "Example/Card",
  component: Card,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof Card>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    label: "Building 1 mine on planet H6",
    enabled: true,
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    label: "Large",
    enabled: true,
  },
};

export const LargeDisabled: Story = {
  args: {
    size: "lg",
    label: "Large",
    enabled: false,
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    label: "Medium",
    enabled: true,
  },
};

export const MediumDisabled: Story = {
  args: {
    size: "md",
    label: "Medium",
    enabled: false,
  },
};
