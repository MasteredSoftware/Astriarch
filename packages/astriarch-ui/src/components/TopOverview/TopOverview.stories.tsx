import type { Meta, StoryObj } from "@storybook/react";

import TopOverview from "./index";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof TopOverview> = {
  title: "Example/TopOverview",
  component: TopOverview,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof TopOverview>;
const resourceData = {
  total: {
    food: 3,
    energy: 5,
    research: 1,
    ore: 2,
    iridium: 1,
    production: 42,
  },
  perTurn: {
    food: -3.5556,
    energy: 5.23221,
    research: 10,
    ore: 12,
    iridium: 3,
    production: 5.7892,
  },
};

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    population: 42,
    resourceData,
  },
};
