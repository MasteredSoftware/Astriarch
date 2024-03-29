import { tabsAnatomy } from "@chakra-ui/anatomy";
import { createMultiStyleConfigHelpers } from "@chakra-ui/react";

const { definePartsStyle, defineMultiStyleConfig } = createMultiStyleConfigHelpers(tabsAnatomy.keys);

// define the base component styles
const baseStyle = definePartsStyle({
  // define the part you're going to style
  tab: {
    _selected: {
      borderColor: "inherit",
      borderBottom: "none",
      mb: "0px",
    },
  },
  tablist: {
    mb: "-1px",
  }
});

type TabsStyle = {baseStyle?: typeof baseStyle};

// export the component theme
export const tabsTheme: TabsStyle = defineMultiStyleConfig({ baseStyle });
