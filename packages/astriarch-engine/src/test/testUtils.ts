import { ClientGameModel } from "../engine/clientGameModel";
import { Engine } from "../engine/engine";
import { GameModel, GameModelData, playerColors } from "../engine/gameModel";
import { Player } from "../engine/player";
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from "../model/model";
import { PlayerData, PlayerType } from "../model/player";
import { ResearchType } from "../model/research";
import { CitizenWorkerType } from "../model/planet";
import { ClientModelData } from "../model/clientModel";

export interface TestGameData {
  engine: Engine;
  gameModel: GameModelData;
}

export const startNewTestGame = (): TestGameData => {
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

  const engine = new Engine([gameModel]);

  return { engine, gameModel };
};
