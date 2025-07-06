import React, { useCallback } from "react";
import "./App.css";
import { 
  startNewGame, 
  advanceClientGameModelTime, 
  getPlayerTotalResources, 
  subscribeToEvents,
  Grid,
  Research
} from "astriarch-engine";
import type { 
  ClientModelData,
  EventNotification,
  PlanetResourceData
} from "astriarch-engine";

import { 
  Button,
  HStack,
  Card,
  Box,
  Text,
  Heading,
  Alert,
} from "@chakra-ui/react";

// REF: https://css-tricks.com/using-requestanimationframe-with-react-hooks/
const useAnimationFrame = (callback: (deltaTime: number) => void) => {
  // Use useRef for mutable variables that we want to persist
  // without triggering a re-render on their change
  const requestRef = React.useRef(0);
  const previousTimeRef = React.useRef(0);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  React.useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);
};

// Simple Counter Component
const Counter = () => {
  const [count, setCount] = React.useState(0);

  useAnimationFrame((deltaTime) => {
    setCount((prevCount) => (prevCount + deltaTime * 0.01) % 100);
  });

  return <div>{Math.round(count)}</div>;
};

interface AstriarchFrameProps {
  clientGameModel: ClientModelData;
  grid: Grid;
}

const AstriarchFrame = ({ clientGameModel, grid }: AstriarchFrameProps) => {
  const [clientGameModelState, setClientGameModelState] = React.useState(clientGameModel);
  const initialResources = getPlayerTotalResources(clientGameModel.mainPlayer, clientGameModel.mainPlayerOwnedPlanets);
  const [resourcesState, setResourcesState] = React.useState<PlanetResourceData>(initialResources);

  useAnimationFrame(() => {
    const newClientGameModel = advanceClientGameModelTime(clientGameModelState, grid);
    const resources = getPlayerTotalResources(newClientGameModel.mainPlayer, newClientGameModel.mainPlayerOwnedPlanets);
    setResourcesState(resources);

    setClientGameModelState(newClientGameModel);
  });

  let currentlyResearching = "Nothing";
  if (clientGameModelState.mainPlayer.research.researchTypeInQueue) {
    currentlyResearching = Research.researchProgressToString(
      clientGameModelState.mainPlayer.research.researchProgressByType[
        clientGameModelState.mainPlayer.research.researchTypeInQueue
      ]
    );
  }

  return <ResourceHeader resources={resourcesState} currentlyResearching={currentlyResearching} />;
};

// Resource display component
const ResourceHeader = ({ resources, currentlyResearching }: { resources: PlanetResourceData; currentlyResearching: string }) => {
  const formattedResources: Record<string, string> = {};
  for (const [resource, val] of Object.entries(resources)) {
    formattedResources[resource] = (val as number).toFixed(1);
  }

  return (
    <HStack gap={4}>
      <Card.Root variant="outline" size="sm" width="100px">
        <Card.Body>
          <Text fontWeight="bold">Food: {formattedResources.food}</Text>
        </Card.Body>
      </Card.Root>
      <Card.Root variant="outline" size="sm" width="100px">
        <Card.Body>
          <Text fontWeight="bold">Energy: {formattedResources.energy}</Text>
        </Card.Body>
      </Card.Root>
      <Card.Root variant="outline" size="sm" width="100px">
        <Card.Body>
          <Text fontWeight="bold">Research: {formattedResources.research}</Text>
        </Card.Body>
      </Card.Root>
      <Box>Researching: {currentlyResearching}</Box>
      <Card.Root variant="outline" size="sm" width="100px">
        <Card.Body>
          <Text fontWeight="bold">Ore: {formattedResources.ore}</Text>
        </Card.Body>
      </Card.Root>
      <Card.Root variant="outline" size="sm" width="100px">
        <Card.Body>
          <Text fontWeight="bold">Iridium: {formattedResources.iridium}</Text>
        </Card.Body>
      </Card.Root>
    </HStack>
  );
};

function App() {
  const { gameModel, clientGameModel } = startNewGame();
  const [notifications, setNotifications] = React.useState<string[]>([]);
  
  const eventCallback = (_playerId: string, enList: EventNotification[]) => {
    for (const en of enList) {
      setNotifications(prev => [...prev, en.message]);
    }
  };
  
  subscribeToEvents("me", eventCallback);
  
  return (
    <div>
      <Box mb={4}>
        <Card.Root>
          <Card.Header>
            <Heading size="md">Astriarch Game</Heading>
          </Card.Header>
          <Card.Body>
            <AstriarchFrame clientGameModel={clientGameModel} grid={gameModel.grid} />
          </Card.Body>
        </Card.Root>
      </Box>
      
      {notifications.length > 0 && (
        <Box mb={4}>
          {notifications.map((message, index) => (
            <Alert.Root key={index} status="success" mb={2}>
              <Alert.Title>Event Notification</Alert.Title>
              <Alert.Description>{message}</Alert.Description>
            </Alert.Root>
          ))}
        </Box>
      )}
      
      <Button
        onClick={() => {
          setNotifications(prev => [...prev, "New game event occurred!"]);
        }}
      >
        Simulate Event
      </Button>
      
      <HStack gap={4} mt={4}>
        {["sm", "md", "lg"].map((size) => (
          <Card.Root key={size} variant="outline" size={size === "sm" ? "sm" : size === "md" ? "md" : "lg"}>
            <Card.Body>
              <Heading size={size === "sm" ? "sm" : size === "md" ? "md" : "lg"}>Planet {size}</Heading>
            </Card.Body>
          </Card.Root>
        ))}
      </HStack>
      
      <Box mt={4}>
        <Counter />
      </Box>
    </div>
  );
}

export default App;
