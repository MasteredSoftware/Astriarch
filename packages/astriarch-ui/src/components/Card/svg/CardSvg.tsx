import { Box } from "@chakra-ui/react";
import { Size } from "../../component.types";
import { CardSvgLarge } from "./CardSvgLarge";
import { CardSvgMedium } from "./CardSvgMedium";

export interface CardSvgProps {
  size: Size;
  enabled: boolean;
}

export const CardSvg = (props: CardSvgProps) => {
  const { size, enabled } = props;
  const component = size === "lg" ? CardSvgLarge : CardSvgMedium;
  return <Box css={{ position: "absolute", top: 0 }}>{component({ enabled })}</Box>;
};
