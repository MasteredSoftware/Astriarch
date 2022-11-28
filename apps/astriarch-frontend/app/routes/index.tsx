import React, { useContext, useEffect } from "react";
import { startNewGame, advanceClientGameModelTime, getPlayerTotalResources, subscribeToEvents } from "astriarch-engine";

import { Tabs, TabList, TabPanels, Tab, TabPanel, useToast, Button } from "@chakra-ui/react";
import { Tag, TagLabel, TagLeftIcon, TagRightIcon, TagCloseButton, HStack } from "@chakra-ui/react";
import { ClientModelData } from "astriarch-engine/src/model/clientModel";
import { EventNotification } from "astriarch-engine/dist/model/eventNotification";

// REF: https://css-tricks.com/using-requestanimationframe-with-react-hooks/
const useAnimationFrame = (callback: any) => {
  // Use useRef for mutable variables that we want to persist
  // without triggering a re-render on their change
  const requestRef = React.useRef(0);
  const previousTimeRef = React.useRef(0);

  const animate = (time: number) => {
    if (previousTimeRef.current != undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  React.useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // Make sure the effect runs only once
};

const Counter = () => {
  const [count, setCount] = React.useState(0);

  useAnimationFrame((deltaTime: number) => {
    // Pass on a function to the setter of the state
    // to make sure we always have the latest state
    setCount((prevCount) => (prevCount + deltaTime * 0.01) % 100);
  });

  return <div>{Math.round(count)}</div>;
};

interface AstriarchResourcesProps {
  clientGameModel: ClientModelData;
}

const AstriarchResources = ({ clientGameModel }: AstriarchResourcesProps) => {
  const [clientGameModelState, setClientGameModelState] = React.useState(clientGameModel);

  const formattedResources: Record<string, string> = {};
  const [formattedResourcesState, setFormattedResourcesState] = React.useState(formattedResources);

  useAnimationFrame((deltaTime: number) => {
    const newClientGameModel = advanceClientGameModelTime(clientGameModelState);
    const resources = getPlayerTotalResources(newClientGameModel.mainPlayer, newClientGameModel.mainPlayerOwnedPlanets);

    console.log("resources:", resources);
    for (const [resource, val] of Object.entries(resources)) {
      formattedResources[resource] = val.toFixed(1);
    }

    setClientGameModelState(() => ({ ...newClientGameModel }));
    setFormattedResourcesState(formattedResources);
  });

  return (
    <HStack spacing={4}>
      <Tag size={"sm"} key={"sm-food"} variant="outline" colorScheme="green" width={100}>
        <TagLeftIcon />
        <TagLabel>{formattedResourcesState.food}</TagLabel>
      </Tag>
      <Tag size={"sm"} key={"sm-energy"} variant="outline" colorScheme="blue" width={100}>
        <TagLabel>{formattedResourcesState.energy}</TagLabel>
      </Tag>
      <Tag size={"sm"} key={"sm-research"} variant="outline" colorScheme="blue" width={100}>
        <TagLabel>{formattedResourcesState.research}</TagLabel>
      </Tag>
      <Tag size={"sm"} key={"sm-ore"} variant="outline" colorScheme="blue" width={100}>
        <TagLabel>{formattedResourcesState.ore}</TagLabel>
      </Tag>
      <Tag size={"sm"} key={"sm-iridium"} variant="outline" colorScheme="blue" width={100}>
        <TagLabel>{formattedResourcesState.iridium}</TagLabel>
      </Tag>
    </HStack>
  );
};

export default function Index() {
  const { gameModel, clientGameModel } = startNewGame();
  const toast = useToast();
  const eventCallback = (playerId: string, enList: EventNotification[]) => {
    for (var en of enList) {
      toast({
        title: "Event Notification",
        description: en.message,
        status: "success",
        duration: 9000,
        isClosable: true,
      });
    }
  };
  subscribeToEvents("me", eventCallback);
  return (
    <div>
      <Tabs>
        <TabList>
          <Tab>One</Tab>
          <Tab>Two</Tab>
          <Tab>Three</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <p>one!</p>
          </TabPanel>
          <TabPanel>
            <p>two!</p>
          </TabPanel>
          <TabPanel>
            <p>three!</p>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <Button
        onClick={() =>
          toast({
            title: "Account created.",
            description: "We've created your account for you.",
            status: "success",
            duration: 9000,
            isClosable: true,
          })
        }
      >
        Show Toast
      </Button>
      <HStack spacing={4}>
        {["sm", "md", "lg"].map((size) => (
          <Tag size={size} key={size} variant="outline" colorScheme="blue">
            <TagLabel>Blue</TagLabel>
            <TagRightIcon />
          </Tag>
        ))}
      </HStack>
      <Counter />
      <AstriarchResources clientGameModel={clientGameModel} />
    </div>
  );
}
