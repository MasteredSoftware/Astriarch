import { Box } from "@chakra-ui/react";
import React, { useState } from "react";
import TopOverviewItem from "../TopOverviewItem";
import { TopOverviewFrameSvg } from "./svg/TopOverviewFrameSvg";

export interface PlanetResourceData {
  food: number;
  energy: number;
  research: number;
  ore: number;
  iridium: number;
  production: number;
}

export interface ResourceData {
  total: PlanetResourceData;
  perTurn: PlanetResourceData;
}

export interface TopOverviewProps {
  children?: React.ReactNode;
  resourceData: ResourceData;
  population: number;
}

const TopOverview: React.FC<TopOverviewProps> = (props) => {
  const { children, resourceData, population, ...rest } = props;
  return (
    <Box {...rest} position={"relative"} display={'inline-flex'} gap={'26px'}>
      <TopOverviewItem type="population" amount={population} />
      <TopOverviewItem
        type="research"
        amount={resourceData.total.research}
        amountPerTurn={resourceData.perTurn.research}
      />
      <TopOverviewItem type="energy" amount={resourceData.total.energy} amountPerTurn={resourceData.perTurn.energy} />
      <TopOverviewItem type="food" amount={resourceData.total.food} amountPerTurn={resourceData.perTurn.food} />
      <TopOverviewItem type="ore" amount={resourceData.total.ore} amountPerTurn={resourceData.perTurn.ore} />
      <TopOverviewItem
        type="iridium"
        amount={resourceData.total.iridium}
        amountPerTurn={resourceData.perTurn.iridium}
      />
      <Box css={{ position: "absolute", top: 0, left: 0, zIndex: 2 }}><TopOverviewFrameSvg /></Box>
      {children}
    </Box>
  );
};

export default TopOverview;
