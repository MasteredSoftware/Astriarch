import { ClientGameModel } from "../engine/clientGameModel";
import { Engine } from "../engine/engine";
import { GameModel, GameModelData, playerColors } from "../engine/gameModel";
import { Player } from "../engine/player";
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from "../model/model";
import { PlayerData, PlayerType } from "../model/player";
import { ResearchType } from "../model/research";
import { CitizenWorkerType } from "../model/planet";
import { ClientModelData } from "../model/clientModel";
import { EarnedPointsType } from "../model/earnedPoints";

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

export const startNewTestGameWithOptions = (
  turnNumber: number,
  points: number,
  systemsToGenerate: number,
  planetsPerSystem: number,
  ownedPlanetCount: number,
  playerCount: number
): TestGameData => {
  const players = [] as PlayerData[];
  players.push(Player.constructPlayer("me", PlayerType.Computer_Expert, "Player1", playerColors[0]));
  Player.increasePoints(players[0], EarnedPointsType.POPULATION_GROWTH, points);
  for (let i = 1; i < playerCount; i++) {
    players.push(Player.constructPlayer(`c${i}`, PlayerType.Computer_Expert, `Player${i + 1}`, playerColors[i]));
    Player.increasePoints(players[i], EarnedPointsType.POPULATION_GROWTH, points);
  }

  const gameOptions = {
    systemsToGenerate,
    planetsPerSystem,
    galaxySize: GalaxySizeOption.SMALL,
    distributePlanetsEvenly: true,
    quickStart: true,
    gameSpeed: GameSpeed.NORMAL,
    version: "2.0",
  };

  const gameModel = GameModel.constructData(players, gameOptions);
  gameModel.modelData.currentCycle = turnNumber;

  const ownedPlanetsPlayer1 = ClientGameModel.getOwnedPlanets(players[0].ownedPlanetIds, gameModel.modelData.planets);
  //const ownedPlanetsPlayer2 = ClientGameModel.getOwnedPlanets(players[1].ownedPlanetIds, gameModel.modelData.planets);

  let assignedPlanets = 1;
  for (const p of gameModel.modelData.planets) {
    if (assignedPlanets >= ownedPlanetCount) {
      break;
    }
    if (!(p.id in ownedPlanetsPlayer1) /* && !(p.id in ownedPlanetsPlayer2)*/) {
      GameModel.changePlanetOwner(undefined, players[0], p, gameModel.modelData.currentCycle);
      assignedPlanets++;
    }
  }

  const engine = new Engine([gameModel]);

  return { engine, gameModel };
};
