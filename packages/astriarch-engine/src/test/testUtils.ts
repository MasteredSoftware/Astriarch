import { ClientGameModel } from '../engine/clientGameModel';
import { GameModel, GameModelData, playerColors } from '../engine/gameModel';
import { Player } from '../engine/player';
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from '../model/model';
import { PlayerData, PlayerType } from '../model/player';
import { ResearchType } from '../model/research';
import { CitizenWorkerType } from '../model/planet';
import { ClientModelData } from '../model/clientModel';
import { EarnedPointsType } from '../model/earnedPoints';
import { ComputerPlayer } from '../engine/computerPlayer';

export interface TestGameData {
  gameModel: GameModelData;
}

export const startNewTestGame = (): TestGameData => {
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

  return { gameModel };
};

export const startNewTestGameWithOptions = (
  turnNumber: number,
  points: number,
  systemsToGenerate: number,
  planetsPerSystem: number,
  ownedPlanetCount: number,
  playerCount: number,
  playerType: PlayerType,
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
    version: '2.0',
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
      gameModel.modelData.currentCycle,
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

  return { gameModel };
};

/**
 * Enable AI debug logging for tests
 */
export const enableAIDebug = (): void => {
  ComputerPlayer.setDebugMode(true);
  ComputerPlayer.clearAIDecisions();
};

/**
 * Disable AI debug logging
 */
export const disableAIDebug = (): void => {
  ComputerPlayer.setDebugMode(false);
};

/**
 * Get a summary of AI decisions grouped by category
 */
export const getAIDecisionSummary = () => {
  const decisions = ComputerPlayer.getAIDecisions();
  const summary = {
    total: decisions.length,
    byCategory: {} as Record<string, number>,
    byPlayer: {} as Record<string, number>,
    byTurn: {} as Record<number, number>,
    decisions,
  };

  for (const decision of decisions) {
    // Count by category
    summary.byCategory[decision.category] = (summary.byCategory[decision.category] || 0) + 1;

    // Count by player
    summary.byPlayer[decision.playerName] = (summary.byPlayer[decision.playerName] || 0) + 1;

    // Count by turn
    summary.byTurn[decision.turn] = (summary.byTurn[decision.turn] || 0) + 1;
  }

  return summary;
};

/**
 * Print AI decisions to console in a readable format
 */
export const printAIDecisions = (filterByCategory?: string, filterByPlayer?: string): void => {
  const decisions = ComputerPlayer.getAIDecisions();

  console.log('\n========== AI DECISION LOG ==========');
  console.log(`Total Decisions: ${decisions.length}\n`);

  let filteredDecisions = decisions;
  if (filterByCategory) {
    filteredDecisions = filteredDecisions.filter((d) => d.category === filterByCategory);
  }
  if (filterByPlayer) {
    filteredDecisions = filteredDecisions.filter((d) => d.playerName === filterByPlayer);
  }

  for (const decision of filteredDecisions) {
    console.log(`[Turn ${decision.turn}] [${decision.category.toUpperCase()}] ${decision.playerName}`);
    console.log(`  Decision: ${decision.decision}`);
    console.log(`  Details:`, JSON.stringify(decision.details, null, 2));
    console.log('');
  }

  console.log('========== END AI DECISION LOG ==========\n');
};

/**
 * Export AI decisions to JSON string
 */
export const exportAIDecisionsJSON = (): string => {
  const summary = getAIDecisionSummary();
  return JSON.stringify(summary, null, 2);
};
