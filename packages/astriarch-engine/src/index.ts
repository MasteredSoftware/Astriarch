import { ClientGameModel } from './engine/clientGameModel';
import { Events, Subscription } from './engine/events';
import { Fleet } from './engine/fleet';
import { GameController } from './engine/gameController';
import { GameModel, GameModelData, playerColors } from './engine/gameModel';
import { Player } from './engine/player';
import { Planet } from './engine/planet';
import { PlanetProductionItem, CanBuildResult, CanBuildValidationResult } from './engine/planetProductionItem';
import { Research } from './engine/research';
import { TradingCenter } from './engine/tradingCenter';
import { ClientModelData, PlanetById, ClientPlayer } from './model/clientModel';
import { StarShipType, FleetData, StarshipData } from './model/fleet';
import {
  GalaxySizeOption,
  GameOptions,
  GameSpeed,
  ModelData,
  OpponentOptionType,
  PlanetsPerSystemOption,
  ServerGameOptions,
} from './model/model';
import { PlanetProductionItemData } from './model/planet';
import { PlayerData, PlayerType } from './model/player';
import { ResearchType } from './model/research';
import { TradeType, TradingCenterResourceType, TradeData, TradingCenterData } from './model/tradingCenter';
import { CitizenWorkerType, PlanetType } from './model/planet';
import { Grid } from './engine/grid';
import { EventNotification, EventNotificationType, PlanetaryConflictData } from './model/eventNotification';
import { PlanetData } from './model/planet';
import { GameTools } from './utils/gameTools';

// Export messaging types
export * from './messaging/MessageTypes';

// Export engine classes
export { Player };
export { Planet };
export { PlanetProductionItem };
export { Fleet };
export { GameModel };
export { ClientGameModel };
export { GameController };
export { Events };
export { Grid };
export { Research };
export { TradingCenter };
export { GameTools };

// Export model types and enums
export { PlayerType };
export { StarShipType };
export { GalaxySizeOption };
export { GameSpeed };
export { PlanetsPerSystemOption };
export { ResearchType };
export { CitizenWorkerType };
export { PlanetType };
export { EventNotificationType };
export { CanBuildResult };
export { playerColors };
export { TradeType };
export { TradingCenterResourceType };

// Export interfaces
export type { PlayerData };
export type { GameOptions };
export type { ServerGameOptions };
export type { ModelData };
export type { GameModelData };
export type { ClientModelData };
export type { PlanetById };
export type { ClientPlayer };
export type { PlanetProductionItemData };
export type { CanBuildValidationResult };
export type { Subscription };
export type { FleetData };
export type { StarshipData };
export type { EventNotification };
export type { PlanetaryConflictData };
export type { PlanetData };
export type { TradeData };
export type { TradingCenterData };

export const MS_PER_TICK = 200; // Time for client side refreshes
export const MS_PER_CYCLE = 30 * 1000; // Time per "turn"

export const createGame = (hostPlayerId: string, hostPlayerName: string, gameOptions: GameOptions) => {
  const players = [] as PlayerData[];
  players.push(Player.constructPlayer(hostPlayerId, PlayerType.Human, hostPlayerName, playerColors[0]));
  const gameModel = GameModel.constructData(players, gameOptions);
  return gameModel;
};

export const getDefaultServerGameOptions = (userPreferences: Partial<ServerGameOptions>): ServerGameOptions => {
  const defaults: ServerGameOptions = {
    name: 'New Game',
    mainPlayerName: 'Player',
    systemsToGenerate: 4,
    planetsPerSystem: PlanetsPerSystemOption.FOUR,
    galaxySize: GalaxySizeOption.SMALL,
    gameSpeed: GameSpeed.NORMAL,
    distributePlanetsEvenly: true,
    quickStart: false,
    opponentOptions: [
      { name: '', type: OpponentOptionType.OPEN }, // Player 2: Open
      { name: '', type: OpponentOptionType.HARD_COMPUTER }, // Player 3: Hard Computer
      { name: '', type: OpponentOptionType.EXPERT_COMPUTER }, // Player 4: Expert Computer
    ],
    version: '2.0',
  };

  return {
    ...defaults,
    ...userPreferences,
  };
};

export const constructClientGameModel = (gameModel: ModelData, playerId: string) => {
  const clientModel = ClientGameModel.constructClientGameModel(gameModel, playerId);
  return clientModel;
};

export const startNewGame = () => {
  // NOTE: just for testing right now
  const players = [] as PlayerData[];
  players.push(Player.constructPlayer('me', PlayerType.Human, 'Matt', playerColors[0]));
  players.push(Player.constructPlayer('c1', PlayerType.Computer_Hard, 'Computer1', playerColors[1]));

  players[0].research.researchPercent = 0.9;
  players[0].research.researchTypeInQueue = ResearchType.PROPULSION_IMPROVEMENT;

  const gameOptions = {
    systemsToGenerate: 2,
    planetsPerSystem: PlanetsPerSystemOption.FIVE,
    galaxySize: GalaxySizeOption.SMALL,
    distributePlanetsEvenly: true,
    quickStart: true,
    gameSpeed: GameSpeed.NORMAL,
    version: '2.0',
  };

  const gameModel = GameModel.constructData(players, gameOptions);

  const homePlanet = gameModel.modelData.planets.find((p) => p.id === players[0].homePlanetId);
  homePlanet!.population[0].workerType = CitizenWorkerType.Miner;

  const clientGameModel = ClientGameModel.constructClientGameModel(gameModel.modelData, 'me');

  return { gameModel, clientGameModel };
};

export const advanceGameModelTime = (gameModel: GameModelData) => {
  GameController.advanceGameClock(gameModel);

  return gameModel;
};

export const advanceClientGameModelTime = (
  clientGameModel: ClientModelData,
  grid: Grid,
): { clientGameModel: ClientModelData; fleetsArrivingOnUnownedPlanets: FleetData[] } => {
  const fleetsArrivingOnUnownedPlanets = GameController.advanceClientGameClock(clientGameModel, grid);

  return { clientGameModel, fleetsArrivingOnUnownedPlanets };
};

export const subscribeToEvents = (playerId: string, callback: Subscription) => {
  Events.subscribe(playerId, callback);
};

export const getPlayerTotalResources = (player: PlayerData, planetById: PlanetById) => {
  return GameModel.getPlayerTotalResources(player, planetById);
};

export const getPlayerTotalResourceProductionPerTurn = (player: PlayerData, planetById: PlanetById) => {
  return GameModel.getPlayerTotalResourceProductionPerTurn(player, planetById);
};

export const getPlayerTotalPopulation = (player: PlayerData, planetById: PlanetById) => {
  return GameModel.getPlayerTotalPopulation(player, planetById);
};

export const getEngineVersion = () => {
  return '2.0.0';
};
