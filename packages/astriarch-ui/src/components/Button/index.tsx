import { Box, Button as ChakraButton, ButtonProps as ChakraButtonProps } from "@chakra-ui/react";
import React from "react";
import Text from "../Text";

//import mySvg from "../../assets/test.svg";
import { ButtonSvg } from "../svg/ButtonSvg";

export interface ButtonProps extends ChakraButtonProps {
  // Your additional props go here
  label: string;
  onClick?: () => void;
}

const additionalCss = {
  width: "207px",
  height: "48px",
  backgroundColor: "transparent",
  // flexShrink: 0,
  // fill: '#0FF',
  // strokeWidth: '2px',
  // stroke: '#000',
  // filter: 'drop-shadow(0px 16px 32px rgba(0, 0, 0, 0.60))',
};

const Button: React.FC<ButtonProps> = ({ children, label, size, ...rest }) => {
  return (
    <>
      <ChakraButton
        {...rest}
        css={{ ...additionalCss, borderRadius: 0 }}
        _hover={{ backgroundColor: "transparent", opacity: 0.9 }}
        _active={{ backgroundColor: "transparent", opacity: 1.0 }}
      >
        <Text css={{ zIndex: 100 }}>{label}</Text>
        <ButtonSvg size={size || ("lg" as any)} />
        {children}
      </ChakraButton>
    </>
  );
};

export default Button;
