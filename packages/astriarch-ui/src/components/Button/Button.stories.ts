import type { Meta, StoryObj } from "@storybook/react";

import Button from "./index";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Button> = {
  title: "Example/Button",
  component: Button,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    backgroundColor: { control: "color" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    isActive: true,
    label: "Button",
  },
};

export const Secondary: Story = {
  args: {
    isActive: false,
    label: "Button",
    variant: "outline",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    label: "Button",
  },
};

export const LargeSecondary: Story = {
  args: {
    size: "lg",
    label: "Button",
    variant: "outline",
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    label: "Button",
  },
};

export const MediumSecondary: Story = {
  args: {
    size: "md",
    label: "Button",
    variant: "outline",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    label: "Button",
  },
};

export const SmallSecondary: Story = {
  args: {
    size: "sm",
    label: "Button",
    variant: "outline",
  },
};
