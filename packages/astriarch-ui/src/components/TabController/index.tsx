import { Box, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import React, { useState } from "react";
import { TabControllerSvg } from "./svg/TabControllerSvg";
import { Size, TabControllerTab } from "../component.types";
import Tab from "../Tab";

export interface TabControllerProps {
  children?: React.ReactNode;
  tabs: TabControllerTab[];
  size?: Size;
  onClick?: () => void;
}

const TabController: React.FC<TabControllerProps> = ({ children, tabs, size, ...rest }) => {
  const [tabIndex, setTabIndex] = useState(0);
  return (
    <Box {...rest} position={"relative"}>
      <Tabs variant="unstyled" defaultIndex={tabIndex} onChange={(index) => setTabIndex(index)}>
        <TabList border={'none'}>
          {tabs.map((tab, i) => (
            <Tab label={tab.label} selected={i === tabIndex} zIndex={i === tabIndex ? tabs.length : tabs.length - i} />
          ))}
        </TabList>
        <TabControllerSvg size={size || "sm"} />
        <TabPanels>
          
          {tabs.map((tab) => (
            <TabPanel>{tab.children}</TabPanel>
          ))}
        </TabPanels>
      </Tabs>
      
      {children}
    </Box>
  );
};

export default TabController;
