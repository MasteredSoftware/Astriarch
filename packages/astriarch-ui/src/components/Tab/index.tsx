import { Tab as ChakraTab } from "@chakra-ui/react";
import React from "react";
import Text from "../Text";
import { TabSvg } from "./svg/TabSvg";

export interface TabProps {
  label: string;
  selected: boolean;
  zIndex: number;
  onClick?: () => void;
}

const Tab: React.FC<TabProps> = ({ label, selected, zIndex, ...rest }) => {
  const additionalTextCss = {
    color: "#FFF",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: "20px",
    letterSpacing: "2px",
    ...(selected
      ? {}
      : {
          textShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)",
          WebkitTextStroke: "1px #000",
        }),
  };

  return (
    <ChakraTab position={"relative"} zIndex={zIndex} width={180}>
      <Text css={{ zIndex: 100, ...additionalTextCss }} textTransform={"uppercase"} textAlign={"center"}>
        {label}
      </Text>
      <TabSvg selected={selected} />
    </ChakraTab>
  );
};

export default Tab;
