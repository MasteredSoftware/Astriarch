import { Box } from "@chakra-ui/react";
import React from "react";

export type IconImageType = "population" | "food" | "energy" | "research" | "ore" | "iridium";

export interface IconImageProps {
  type: IconImageType;
  size?: number;
  altText?: string;
}

const IconImage: React.FC<IconImageProps> = (props) => {
  const { type, size, altText, ...rest } = props;
  const icon = require(`../../assets/icons/${type}.svg`);
  const alt = altText ?? type.charAt(0).toUpperCase() + type.slice(1);
  return (
    <Box
      {...rest}
      css={{ width: size || 32, height: size || 32, display: "flex", justifyContent: "center", alignItems: "center" }}
    >
      <img src={icon} alt={alt} />
    </Box>
  );
};

export default IconImage;
