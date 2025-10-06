import { Box, Flex, useDisclosure } from "@chakra-ui/react";
import React, { useState } from "react";
import Text from "../Text";

export interface NavigationItem {
  label: string;
  content?: React.ReactNode;
  onClick?: () => void;
}

export interface NavigationControllerProps {
  items: NavigationItem[];
  initialSelectedIndex?: number;
  onChange?: (index: number) => void;
}

/**
 * Navigation controller for bottom tabs as shown in the design
 */
const NavigationController: React.FC<NavigationControllerProps> = ({
  items,
  initialSelectedIndex = 0,
  onChange,
  ...rest
}) => {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);

  const handleTabClick = (index: number) => {
    setSelectedIndex(index);
    if (onChange) {
      onChange(index);
    }
    if (items[index].onClick) {
      items[index].onClick!();
    }
  };

  return (
    <Box position="relative" {...rest}>
      <Flex
        position="relative"
        justifyContent="center"
        alignItems="center"
        height="48px"
        width="100%"
        backgroundColor="rgba(0, 0, 0, 0.6)"
        borderTopWidth="1px"
        borderTopColor="rgba(0, 255, 255, 0.3)"
        boxShadow="0px -4px 16px rgba(0, 0, 0, 0.5)"
        backdropFilter="blur(5px)"
      >
        {items.map((item, i) => (
          <Box
            key={`nav-tab-${i}`}
            position="relative"
            width="172px"
            mx={1}
            role="button"
            onClick={() => handleTabClick(i)}
            cursor="pointer"
          >
            {/* Tab background */}
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              borderRadius="4px 4px 0 0"
              bg={i === selectedIndex ? "cyan.400" : "transparent"}
              border="1px solid"
              borderColor={i === selectedIndex ? "cyan.400" : "cyan.300"}
              opacity={i === selectedIndex ? 1 : 0.7}
              transition="all 0.2s"
              zIndex={0}
            />

            {/* Tab text */}
            <Text
              position="relative"
              fontSize="14px"
              fontWeight={800}
              lineHeight="48px"
              letterSpacing="2px"
              textTransform="uppercase"
              textAlign="center"
              color={i === selectedIndex ? "#1B1F25" : "#FFFFFF"}
              zIndex={1}
            >
              {item.label}
            </Text>
          </Box>
        ))}
      </Flex>

      {/* Content area */}
      <Box>{items[selectedIndex]?.content}</Box>
    </Box>
  );
};

export default NavigationController;
