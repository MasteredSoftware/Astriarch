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
  playerCount: number,
  playerType: PlayerType
): TestGameData => {
  const players = [] as PlayerData[];
  for (let i = 0; i < playerCount; i++) {
    const player = Player.constructPlayer(`p${i}`, playerType, `Player${i + 1}`, playerColors[i]);
    players.push(player);
    Player.increasePoints(player, EarnedPointsType.POPULATION_GROWTH, points);
  }

  const gameOptions = {
    systemsToGenerate,
    planetsPerSystem,
    galaxySize: GalaxySizeOption.LARGE,
    distributePlanetsEvenly: true,
    quickStart: true,
    gameSpeed: GameSpeed.NORMAL,
    version: "2.0",
  };

  const gameModel = GameModel.constructData(players, gameOptions);
  gameModel.modelData.currentCycle = turnNumber;

  const [firstPlayer] = players;
  const ownedPlanetsPlayer1 = ClientGameModel.getOwnedPlanets(firstPlayer.ownedPlanetIds, gameModel.modelData.planets);

  if (ownedPlanetCount === 0) {
    GameModel.changePlanetOwner(
      firstPlayer,
      undefined,
      ownedPlanetsPlayer1[firstPlayer.ownedPlanetIds[0]],
      gameModel.modelData.currentCycle
    );
  }

  let assignedPlanets = 1;
  for (const p of gameModel.modelData.planets) {
    if (assignedPlanets >= ownedPlanetCount) {
      break;
    }
    if (!(p.id in ownedPlanetsPlayer1)) {
      const oldOwner = GameModel.findPlanetOwner(gameModel, p.id);
      GameModel.changePlanetOwner(oldOwner, firstPlayer, p, gameModel.modelData.currentCycle);
      assignedPlanets++;
    }
  }

  const engine = new Engine([gameModel]);

  return { engine, gameModel };
};
