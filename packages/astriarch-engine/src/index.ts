import { ClientGameModel } from './engine/clientGameModel';
import { Events, Subscription } from './engine/events';
import { GameController } from './engine/gameController';
import { GameModel, GameModelData, playerColors } from './engine/gameModel';
import { Player } from './engine/player';
import { Planet } from './engine/planet';
import { ClientModelData, PlanetById } from './model/clientModel';
import { GalaxySizeOption, GameOptions, GameSpeed, ModelData, PlanetsPerSystemOption } from './model/model';
import { PlanetProductionItemData } from './model/planet';
import { PlayerData, PlayerType } from './model/player';
import { ResearchType } from './model/research';
import { CitizenWorkerType } from './model/planet';
import { Grid } from './engine/grid';

// Export messaging types
export * from './messaging/MessageTypes';

// Export engine classes
export { Player };
export { Planet };
export { GameModel };
export { ClientGameModel };
export { GameController };
export { Events };
export { Grid };

// Export model types and enums
export { PlayerType };
export { GalaxySizeOption };
export { GameSpeed };
export { PlanetsPerSystemOption };
export { ResearchType };
export { CitizenWorkerType };
export { playerColors };

// Export interfaces
export type { PlayerData };
export type { GameOptions };
export type { ModelData };
export type { GameModelData };
export type { ClientModelData };
export type { PlanetById };
export type { PlanetProductionItemData };
export type { Subscription };

export const MS_PER_TICK = 200; // Time for client side refreshes
export const MS_PER_CYCLE = 30 * 1000; // Time per "turn"

export const createGame = (hostPlayerId: string, hostPlayerName: string, gameOptions: GameOptions) => {
  const players = [] as PlayerData[];
  players.push(Player.constructPlayer(hostPlayerId, PlayerType.Human, hostPlayerName, playerColors[0]));
  const gameModel = GameModel.constructData(players, gameOptions);
  return gameModel;
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

export const advanceClientGameModelTime = (clientGameModel: ClientModelData, grid: Grid) => {
  GameController.advanceClientGameClock(clientGameModel, grid);

  return clientGameModel;
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
