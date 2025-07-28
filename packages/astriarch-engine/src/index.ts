import { ClientGameModel } from "./engine/clientGameModel";
import { Engine } from "./engine/engine";
import { Events, Subscription } from "./engine/events";
import { GameController } from "./engine/gameController";
import { GameModel, GameModelData, playerColors } from "./engine/gameModel";
import { Player } from "./engine/player";
import { ClientModelData, PlanetById } from "./model/clientModel";
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from "./model/model";
import { PlayerData, PlayerType } from "./model/player";
import { ResearchType } from "./model/research";
import { CitizenWorkerType } from "./model/planet";
import { Grid } from "./engine/grid";

// Export messaging types
export * from "./messaging/MessageTypes";

export const MS_PER_TICK = 200; // Time for client side refreshes
export const MS_PER_CYCLE = 30 * 1000; // Time per "turn"

const engine = new Engine([]);

export const startNewGame = () => {
  // NOTE: just for testing right now
  const players = [] as PlayerData[];
  players.push(Player.constructPlayer("me", PlayerType.Human, "Matt", playerColors[0]));
  players.push(Player.constructPlayer("c1", PlayerType.Computer_Hard, "Computer1", playerColors[1]));

  players[0].research.researchPercent = 0.9;
  players[0].research.researchTypeInQueue = ResearchType.PROPULSION_IMPROVEMENT;

  const gameOptions = {
    systemsToGenerate: 2,
    planetsPerSystem: PlanetsPerSystemOption.FIVE,
    galaxySize: GalaxySizeOption.SMALL,
    distributePlanetsEvenly: true,
    quickStart: true,
    gameSpeed: GameSpeed.NORMAL,
    version: "2.0",
  };

  const gameModel = GameModel.constructData(players, gameOptions);

  const homePlanet = gameModel.modelData.planets.find((p) => p.id === players[0].homePlanetId);
  homePlanet!.population[0].workerType = CitizenWorkerType.Miner;

  engine.serverGameModels.push(gameModel);

  const clientGameModel = ClientGameModel.constructClientGameModel(gameModel.modelData, "me");

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

// TODO: decide what the engine should actually export
export * from "./engine";
export * from "./model";
