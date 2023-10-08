import { Button as ChakraButton, ButtonProps as ChakraButtonProps } from "@chakra-ui/react";
import React from "react";
import Text from "../Text";

//import mySvg from "../../assets/test.svg";
import { ButtonSvg, Size } from "../svg/ButtonSvg";

export interface ButtonProps extends ChakraButtonProps {
  // Your additional props go here
  label: string;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({ children, label, size, variant, ...rest }) => {
  const buttonSize = (size || "lg") as Size;
  const widthBySize = {
    lg: "207px",
    md: "157px",
    sm: "87px",
    xs: "87px",
  };

  const additionalButtonCss = {
    width: "207px",
    height: "48px",
    backgroundColor: "transparent",
    // flexShrink: 0,
    // fill: '#0FF',
    // strokeWidth: '2px',
    // stroke: '#000',
    // filter: 'drop-shadow(0px 16px 32px rgba(0, 0, 0, 0.60))',
  };

  const additionalTextCss = {
    color: "#1B1F25",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: "20px",
    letterSpacing: "2px",
  };

  additionalButtonCss.width = widthBySize[buttonSize];
  if (variant === "outline") {
    additionalTextCss.color = "#0FF";
  }
  return (
    <>
      <ChakraButton
        {...rest}
        css={{ ...additionalButtonCss, borderRadius: 0 }}
        _hover={{ backgroundColor: "transparent", opacity: 0.9 }}
        _active={{ backgroundColor: "transparent", opacity: 1.0 }}
      >
        <Text css={{ zIndex: 100, ...additionalTextCss }}>{label}</Text>
        <ButtonSvg size={buttonSize as any} variant={variant || ("primary" as any)} />
        {children}
      </ChakraButton>
    </>
  );
};

export default Button;
