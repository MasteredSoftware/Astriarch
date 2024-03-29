import { Box } from "@chakra-ui/react";
import React from "react";
import Text from "../Text";
import { NavigationTabSvg } from "./svg/NavigationTabSvg";

export interface NavigationTabProps {
  label: string;
  selected: boolean;
  zIndex: number;
  onClick?: () => void;
}

const NavigationTab: React.FC<NavigationTabProps> = ({ label, selected, zIndex, onClick, ...rest }) => {
  const additionalTextCss = {
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: "48px",
    letterSpacing: "2px",
    width: 240,
    ...(selected
      ? { color: "#1B1F25" }
      : {
          color: "#FFF",
        }),
  };

  return (
    <Box position={"relative"} width={172} pointerEvents={'none'}>
      <Text
        css={{ zIndex: 100, ...additionalTextCss }}
        position={"relative"}
        textTransform={"uppercase"}
        textAlign={"center"}
        verticalAlign={"baseline"}
        pointerEvents={'none'}
      >
        {label}
      </Text>
      <NavigationTabSvg selected={selected} onClick={onClick} />
    </Box>
  );
};

export default NavigationTab;
