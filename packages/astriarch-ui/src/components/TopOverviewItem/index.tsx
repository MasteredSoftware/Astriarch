import { Box } from "@chakra-ui/react";
import React from "react";
import Text from "../Text";
import IconImage from "../IconImage";

export interface TopOverviewItemProps {
  children?: React.ReactNode;
  amount: number;
  amountPerTurn?: number;
  type: "population" | "food" | "energy" | "research" | "ore" | "iridium";
  onClick?: () => void;
}

const TopOverviewItem: React.FC<TopOverviewItemProps> = (props) => {
  const { children, amount, amountPerTurn, type, ...rest } = props;
  const amountFormatted = Math.floor(amount);
  const amountPerTurnFormatted = amountPerTurn ? amountPerTurn.toFixed(1) : null;
  const amountPerTurnSign = amountPerTurn ? (amountPerTurn > 0 ? "+" : "") : "";
  const amountContent = amountPerTurn
    ? `${amountFormatted}  ${amountPerTurnSign}${amountPerTurnFormatted}`
    : amountFormatted;
  const additionalTextCss = {
    color: "#FFF",
    fontSize: "18px",
    fontWeight: 600,
    lineHeight: "32px",
    letterSpacing: "0.09px",
  };

  return (
    <Box {...rest} position={"relative"} display={"flex"} css={{ zIndex: 100 }}>
      <IconImage type={type} size={32} />
      <Text css={{ marginLeft: 4, display: "inline-block", ...additionalTextCss }} verticalAlign={"bottom"}>
        {amountContent}
      </Text>

      {children}
    </Box>
  );
};

export default TopOverviewItem;
