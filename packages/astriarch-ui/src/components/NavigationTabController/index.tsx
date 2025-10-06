import { Box } from "@chakra-ui/react";
import React, { useState } from "react";
import NavigationTab from "../NavigationTab";

export interface NavigationTabControllerProps {
  children?: React.ReactNode;
  labels: string[];
  onTabClick?: (i: number) => void;
}

const NavigationTabController: React.FC<NavigationTabControllerProps> = ({ children, labels, onTabClick, ...rest }) => {
  const [tabIndex, setTabIndex] = useState(0);
  return (
    <Box {...rest} position={"relative"} display={"flex"}>
      {labels.map((label, i) => (
        <NavigationTab
          key={`navigationTab-${i}`}
          label={label}
          selected={i === tabIndex}
          zIndex={i === tabIndex ? labels.length : labels.length - i}
          onClick={() => {
            setTabIndex(i);
            onTabClick?.(i);
          }}
        />
      ))}

      {children}
    </Box>
  );
};

export default NavigationTabController;
