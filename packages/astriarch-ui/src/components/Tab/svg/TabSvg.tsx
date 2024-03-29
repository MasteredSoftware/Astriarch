import { Box } from "@chakra-ui/react";
import { TabSvgSelected } from "./TabSvgSelected";
import { TabSvgUnselected } from "./TabSvgUnselected";

export interface TabSvgProps {
  selected: boolean;
}

export const TabSvg = (props: TabSvgProps) => {
  const { selected } = props;
  const component = selected ? TabSvgSelected : TabSvgUnselected;
  return <Box css={{ position: "absolute", top: 0, left: 0 }}>{component()}</Box>;
};
