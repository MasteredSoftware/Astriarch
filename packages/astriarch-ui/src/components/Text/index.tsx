import { Text as ChakraText, TextProps as ChakraTextProps } from "@chakra-ui/react";
import React from "react";

export interface TextProps extends ChakraTextProps {
  // Your additional props go here
}

const Text: React.FC<TextProps> = ({ children, ...rest }) => {
  return (
    <ChakraText fontFamily={"Orbitron"} {...rest}>
      {children}
    </ChakraText>
  );
};

export default Text;
