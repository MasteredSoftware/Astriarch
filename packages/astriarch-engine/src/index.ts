import { ClientGameModel } from './engine/clientGameModel';
import { Events, Subscription } from './engine/events';
import { GameController } from './engine/gameController';
import { GameModel, GameModelData, playerColors } from './engine/gameModel';
import { Player } from './engine/player';
import { ClientModelData, PlanetById } from './model/clientModel';
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from './model/model';
import { PlayerData, PlayerType } from './model/player';
import { ResearchType } from './model/research';
import { CitizenWorkerType } from './model/planet';
import { Grid } from './engine/grid';

// Export messaging types
export * from './messaging/MessageTypes';

export const MS_PER_TICK = 200; // Time for client side refreshes
export const MS_PER_CYCLE = 30 * 1000; // Time per "turn"

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

// TODO: decide what the engine should actually export
export * from './model';
