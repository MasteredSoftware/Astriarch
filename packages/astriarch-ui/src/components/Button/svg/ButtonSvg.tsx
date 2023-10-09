import { Box, ButtonProps as ChakraButtonProps } from "@chakra-ui/react";
import { ButtonSvgLargePrimary, ButtonSvgMediumPrimary, ButtonSvgSmallPrimary } from "./ButtonSvgPrimary";
import { ButtonSvgLargeSecondary, ButtonSvgMediumSecondary, ButtonSvgSmallSecondary } from "./ButtonSvgSecondary";
import { Size } from "../../component.types";

export interface ButtonSvgProps {
  size: Size; //Pick<ChakraButtonProps, 'size'>;
  variant: "primary" | "outline";
}

const componentBySizePrimary = {
  lg: ButtonSvgLargePrimary,
  md: ButtonSvgMediumPrimary,
  sm: ButtonSvgSmallPrimary,
  xs: ButtonSvgSmallPrimary,
};

const componentBySizeSecondary = {
  lg: ButtonSvgLargeSecondary,
  md: ButtonSvgMediumSecondary,
  sm: ButtonSvgSmallSecondary,
  xs: ButtonSvgSmallSecondary,
};

export const ButtonSvg = (props: ButtonSvgProps) => {
  const { size, variant } = props;
  const component = variant === "primary" ? componentBySizePrimary[size] : componentBySizeSecondary[size];
  return <Box css={{ position: "absolute" }}>{component()}</Box>;
};
