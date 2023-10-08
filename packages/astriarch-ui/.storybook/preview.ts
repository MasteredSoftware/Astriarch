import type { Preview } from "@storybook/react";

import theme from "../src/theme/theme";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    chakra: {
      theme,
    },
    backgrounds: {
      default: "space",
      values: [
        {
          name: "space",
          value: "#000000",
        },
        {
          name: "light",
          value: "#FFFFFF",
        },
      ],
    },
  },
};

export default preview;
