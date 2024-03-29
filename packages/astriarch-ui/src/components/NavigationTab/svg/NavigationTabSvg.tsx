import { Box } from "@chakra-ui/react";
import { NavigationTabSvgSelected } from "./NavigationTabSvgSelected";
import { NavigationTabSvgUnselected } from "./NavigationTabSvgUnselected";

export interface NavigationTabSvgProps {
  selected: boolean;
  onClick?: () => void;
}

export const NavigationTabSvg = (props: NavigationTabSvgProps) => {
  const { selected, onClick } = props;
  const component = selected ? NavigationTabSvgSelected : NavigationTabSvgUnselected;
  return <Box css={{ position: "absolute", top: 0, left: 0 }}>{component({onClick})}</Box>;
};
