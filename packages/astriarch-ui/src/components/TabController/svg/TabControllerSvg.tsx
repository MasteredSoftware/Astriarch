import { Box } from "@chakra-ui/react";
import { TabControllerSvgBaselineSmall } from "./TabControllerSvgBaselineSmall";
import { Size } from "../../component.types";
import { TabControllerSvgBaselineMedium } from "./TabControllerSvgBaselineMedium";
import { TabControllerSvgBaselineLarge } from "./TabControllerSvgBaselineLarge";

export interface TabControllerSvgProps {
  size: Size;
}

export const TabControllerSvg = (props: TabControllerSvgProps) => {
  const { size } = props;
  const component = size === "sm" ? TabControllerSvgBaselineSmall : size === "md" ? TabControllerSvgBaselineMedium : TabControllerSvgBaselineLarge;
  return <Box css={{ position: "relative", top: 0, left: 2 }}>{component()}</Box>;
};
