import { writable, derived } from 'svelte/store';
import { 
  startNewGame, 
  advanceClientGameModelTime, 
  getPlayerTotalResources, 
  getPlayerTotalResourceProductionPerTurn,
  getPlayerTotalPopulation,
  subscribeToEvents,
  type ClientModelData,
  type EventNotification,
  type GameModelData,
  ResearchType
} from 'astriarch-engine';

// Game state stores
export const gameModel = writable<GameModelData | null>(null);
export const clientGameModel = writable<ClientModelData | null>(null);
export const notifications = writable<string[]>([]);
export const gameStarted = writable<boolean>(false);
export const currentTurn = writable<number>(1);

// Resource data derived from client game model
export const resourceData = derived(
  clientGameModel,
  ($clientGameModel) => {
    if (!$clientGameModel) {
      return {
        total: {
          food: 0,
          energy: 0,
          research: 0,
          ore: 0,
          iridium: 0,
          production: 0
        },
        perTurn: {
          food: 0,
          energy: 0,
          research: 0,
          ore: 0,
          iridium: 0,
          production: 0
        }
      };
    }

    // Get actual resources from the game model using the correct API
    const totalResources = getPlayerTotalResources($clientGameModel.mainPlayer, $clientGameModel.mainPlayerOwnedPlanets);
    const perTurnResources = getPlayerTotalResourceProductionPerTurn($clientGameModel.mainPlayer, $clientGameModel.mainPlayerOwnedPlanets);
    
    return {
      total: totalResources,
      perTurn: perTurnResources
    };
  }
);

// Population derived from client game model
export const population = derived(
  clientGameModel,
  ($clientGameModel) => {
    if (!$clientGameModel) return 0;
    
    return getPlayerTotalPopulation($clientGameModel.mainPlayer, $clientGameModel.mainPlayerOwnedPlanets);
  }
);

// Current research derived from client game model
export const currentResearch = derived(
  clientGameModel,
  ($clientGameModel) => {
    if (!$clientGameModel || !$clientGameModel.mainPlayer.research.researchTypeInQueue) {
      return "Nothing";
    }
    
    const researchType = $clientGameModel.mainPlayer.research.researchTypeInQueue;
    const researchNames: Record<number, string> = {
      [ResearchType.NEW_SHIP_TYPE_DEFENDER]: "Defender Ship",
      [ResearchType.NEW_SHIP_TYPE_SCOUT]: "Scout Ship", 
      [ResearchType.NEW_SHIP_TYPE_DESTROYER]: "Destroyer Ship",
      [ResearchType.NEW_SHIP_TYPE_CRUISER]: "Cruiser Ship",
      [ResearchType.NEW_SHIP_TYPE_BATTLESHIP]: "Battleship",
      [ResearchType.COMBAT_IMPROVEMENT_ATTACK]: "Combat Attack",
      [ResearchType.COMBAT_IMPROVEMENT_DEFENSE]: "Combat Defense",
      [ResearchType.PROPULSION_IMPROVEMENT]: "Propulsion",
      [ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS]: "Farm Efficiency",
      [ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES]: "Mine Efficiency",
      [ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES]: "Colony Growth",
      [ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES]: "Factory Efficiency",
      [ResearchType.SPACE_PLATFORM_IMPROVEMENT]: "Space Platforms"
    };
    
    return researchNames[researchType] || "Unknown Research";
  }
);

// Game actions
export const gameActions = {
  startNewGame() {
    const { gameModel: gm, clientGameModel: cgm } = startNewGame();
    gameModel.set(gm);
    clientGameModel.set(cgm);
    gameStarted.set(true);
    currentTurn.set(1);
    
    // Subscribe to game events
    subscribeToEvents("me", (playerId: string, enList: EventNotification[]) => {
      notifications.update(prev => [
        ...prev,
        ...enList.map(en => en.message)
      ]);
    });

    // Add initial notification
    notifications.update(prev => [...prev, "New game started! Welcome to Astriarch."]);
  },

  nextTurn() {
    const cgm = get(clientGameModel);
    const gm = get(gameModel);
    if (cgm && gm) {
      const updatedClientGameModel = advanceClientGameModelTime(cgm, gm.grid);
      clientGameModel.set(updatedClientGameModel);
      currentTurn.update(turn => turn + 1);
      notifications.update(prev => [...prev, `Turn ${get(currentTurn)} begins.`]);
    }
  },

  clearNotifications() {
    notifications.set([]);
  }
};

// Helper to get current store values
function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value: T;
  const unsubscribe = store.subscribe(v => value = v);
  unsubscribe();
  return value!;
}
