import { Box } from "@chakra-ui/react";
import React from "react";
import Text from "../Text";
import { NotificationSvg } from "./svg/NotificationSvg";

export interface NotificationProps {
  children?: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const Notification: React.FC<NotificationProps> = ({ children, label, ...rest }) => {
  const additionalNotificationCss = {
    width: "277px",
    height: "64px",
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
    <Box css={additionalNotificationCss} {...rest} position={"relative"}>
      <Text pt="20px" pl="16px" css={{ zIndex: 100, position: "relative", ...additionalTextCss }}>
        {label}
      </Text>
      <NotificationSvg />
      {children}
    </Box>
  );
};

export default Notification;
