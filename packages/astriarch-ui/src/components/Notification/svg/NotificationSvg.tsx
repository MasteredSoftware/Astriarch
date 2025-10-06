import { Box } from "@chakra-ui/react";
import { NotificationSvgSmall } from "./NotificationSvgSmall";
import { Size } from "../../component.types";
import { NotificationSvgMedium } from "./NotificationSvgMedium";
import { NotificationSvgLarge } from "./NotificationSvgLarge";

export interface NotificationSvgProps {
  size: Size;
}

export const NotificationSvg = (props: NotificationSvgProps) => {
  const { size } = props;
  const component = size === "sm" ? NotificationSvgSmall : size === "md" ? NotificationSvgMedium : NotificationSvgLarge;
  return <Box css={{ position: "absolute", top: 0 }}>{component()}</Box>;
};
