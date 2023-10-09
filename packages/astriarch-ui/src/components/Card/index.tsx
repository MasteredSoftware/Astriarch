import { Box } from "@chakra-ui/react";
import React from "react";
import Text from "../Text";
import { Size } from "../component.types";
import { CardSvg } from "./svg/CardSvg";

export interface CardProps {
  children?: React.ReactNode;
  label: string;
  size?: Size;
  enabled: boolean;
  onClick?: () => void;
}

const Notification: React.FC<CardProps> = ({ children, label, size, enabled, ...rest }) => {
  const additionalCardCss = {
    width: size === "lg" ? "109px" : "115px",
    height: size === "lg" ? "136px" : "76px",
    backgroundColor: "transparent",
  };

  const additionalTextCss = {
    color: "#FFF",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: "28px",
    letterSpacing: "0.14px",
  };
  return (
    <Box css={additionalCardCss} {...rest} position={"relative"}>
      <Text pt="20px" pl="16px" css={{ zIndex: 100, position: "relative", ...additionalTextCss }}>
        {label}
      </Text>
      <CardSvg size={size || "lg"} enabled={enabled} />
      {children}
    </Box>
  );
};

export default Notification;
