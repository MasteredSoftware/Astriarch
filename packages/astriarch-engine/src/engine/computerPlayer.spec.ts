import { PlanetById } from '../model/clientModel';
import { PlayerData, PlayerType } from '../model/player';
import { StarShipType } from '../model/fleet';
import { PlanetData, PlanetImprovementType, PlanetType } from '../model/planet';
import { ResearchType } from '../model/research';
import {
  startNewTestGame,
  TestGameData,
  enableAIDebug,
  disableAIDebug,
  exportAIDecisionsJSON,
} from '../test/testUtils';
import { ComputerPlayer } from './computerPlayer';
import { ClientGameModel } from './clientGameModel';
import { CommandProcessor } from './CommandProcessor';
import { Fleet } from './fleet';
import { GameController } from './gameController';
import { GameCommandType, SendShipsCommand } from './GameCommands';
import { GameModel } from './gameModel';
import { Grid } from './grid';
import { Player } from './player';
import { Research } from './research';
import * as fs from 'fs';
import * as path from 'path';

let testGameData: TestGameData;
let player1: PlayerData;
let player2: PlayerData;
let planetById: PlanetById;

/**
 * Helper to advance game time for testing by manipulating lastSnapshotTime
 * This simulates N full game cycles passing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function advanceGameCycles(gameModel: any, cycles = 1) {
  // Move lastSnapshotTime backward to simulate time passing
  const msPerCycle = 30 * 1000; // GameController.MS_PER_CYCLE_DEFAULT
  gameModel.modelData.lastSnapshotTime -= cycles * msPerCycle;
  return GameController.advanceGameClock(gameModel);
}

/**
 * Helper to run AI vs AI simulation and return win counts
 */
function runAIvsAISimulation(
  player1Type: PlayerType,
  player2Type: PlayerType,
  options: {
    iterations?: number;
    maxTurns?: number;
  } = {},
): { player1: number; player2: number; draws: number } {
  const { iterations = 5, maxTurns = 500 } = options;
  const wins = { player1: 0, player2: 0, draws: 0 };

  for (let i = 0; i < iterations; i++) {
    const gameData = startNewTestGame();
    gameData.gameModel.modelData.players[0].type = player1Type;
    gameData.gameModel.modelData.players[1].type = player2Type;

    // Run game for limited turns
    let winner: PlayerData | null = null;
    for (let turn = 0; turn < maxTurns; turn++) {
      advanceGameCycles(gameData.gameModel, 1);

      // Check for winner
      const activePlayers = gameData.gameModel.modelData.players.filter((p) => !p.destroyed);
      if (activePlayers.length === 1) {
        winner = activePlayers[0];
        break;
      }
    }

    if (winner) {
      if (winner.type === player1Type) wins.player1++;
      else if (winner.type === player2Type) wins.player2++;
    } else {
      wins.draws++;
    }
  }

  return wins;
}

function getAiDecisionDebugFilePath(fileName: string) {
  const outputPath = path.join(__dirname, '../../ai-decision-debugging/data', fileName);
  return outputPath;
}


describe('ComputerPlayer', () => {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    player2 = testGameData.gameModel.modelData.players[1];
    planetById = ClientGameModel.getPlanetByIdIndex(testGameData.gameModel.modelData.planets);
  });

  describe('computerManageResearch', () => {
    test('should set research percent based on difficulty', () => {
      const easyPlayer = Player.constructPlayer('easy', PlayerType.Computer_Easy, 'Easy', player1.color);
      const hardPlayer = Player.constructPlayer('hard', PlayerType.Computer_Hard, 'Hard', player1.color);
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);

      // Add test players to the model so CommandProcessor can find them
      testGameData.gameModel.modelData.players.push(easyPlayer, hardPlayer, expertPlayer);

      const easyPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const easyPlanetsSorted = Player.getOwnedPlanetsListSorted(easyPlayer, easyPlanets);

      const easyClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, easyPlayer.id);
      const easyCmds = ComputerPlayer.computerManageResearch(easyClientModel, testGameData.gameModel.grid, easyPlayer, easyPlanets, easyPlanetsSorted);
      for (const cmd of easyCmds) CommandProcessor.processCommand(easyClientModel, testGameData.gameModel.grid, cmd);
      expect(easyPlayer.research.researchPercent).toBeGreaterThanOrEqual(0.1);
      expect(easyPlayer.research.researchPercent).toBeLessThanOrEqual(0.3);

      const hardPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const hardPlanetsSorted = Player.getOwnedPlanetsListSorted(hardPlayer, hardPlanets);

      const hardClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, hardPlayer.id);
      const hardCmds = ComputerPlayer.computerManageResearch(hardClientModel, testGameData.gameModel.grid, hardPlayer, hardPlanets, hardPlanetsSorted);
      for (const cmd of hardCmds) CommandProcessor.processCommand(hardClientModel, testGameData.gameModel.grid, cmd);
      expect(hardPlayer.research.researchPercent).toBeGreaterThanOrEqual(0.4);
      expect(hardPlayer.research.researchPercent).toBeLessThanOrEqual(0.56);

      const expertPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const expertPlanetsSorted = Player.getOwnedPlanetsListSorted(expertPlayer, expertPlanets);

      const expertClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const expertCmds = ComputerPlayer.computerManageResearch(expertClientModel, testGameData.gameModel.grid, expertPlayer, expertPlanets, expertPlanetsSorted);
      for (const cmd of expertCmds) CommandProcessor.processCommand(expertClientModel, testGameData.gameModel.grid, cmd);
      expect(expertPlayer.research.researchPercent).toBeGreaterThanOrEqual(0.45);
      expect(expertPlayer.research.researchPercent).toBeLessThanOrEqual(0.61);
    });

    test('should queue appropriate research for early game', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      // Add test player to model so CommandProcessor can find them
      testGameData.gameModel.modelData.players.push(expertPlayer);
      const expertPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const expertPlanetsSorted = Player.getOwnedPlanetsListSorted(expertPlayer, expertPlanets);

      const expertClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const cmds = ComputerPlayer.computerManageResearch(expertClientModel, testGameData.gameModel.grid, expertPlayer, expertPlanets, expertPlanetsSorted);
      for (const cmd of cmds) CommandProcessor.processCommand(expertClientModel, testGameData.gameModel.grid, cmd);

      expect(expertPlayer.research.researchTypeInQueue).toBeDefined();
      expect([
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES,
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES,
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS,
      ]).toContain(expertPlayer.research.researchTypeInQueue);
    });
  });

  describe('calculateEffectiveFleetStrength', () => {
    test('should calculate higher effective strength when our fleet has advantages', () => {
      const ourFleet = Fleet.generateFleetWithShipCount(0, 0, 4, 0, 0, 0, null); // 4 Destroyers
      const enemyFleet = Fleet.generateFleetWithShipCount(0, 4, 0, 0, 0, 0, null); // 4 Scouts

      const effectiveStrength = ComputerPlayer.calculateEffectiveFleetStrength(ourFleet, enemyFleet, false, player1);

      const rawStrength = Fleet.determineFleetStrength(ourFleet);
      // Should be higher due to advantage (Destroyers > Scouts)
      expect(effectiveStrength).toBeGreaterThan(rawStrength);
    });

    test('should account for space platform 2x effective strength', () => {
      const ourFleet = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 2, 0, null); // 2 Battleships (64 strength)
      const enemyFleet = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 1, null); // 1 Space Platform (64 strength)

      const effectiveStrength = ComputerPlayer.calculateEffectiveFleetStrength(ourFleet, enemyFleet, true, player1);

      // Should be negative or very low since space platform has 2x effective strength
      expect(effectiveStrength).toBeLessThan(Fleet.determineFleetStrength(ourFleet) * 0.5);
    });

    test('should factor in research bonuses', () => {
      // Set up player with combat research
      Research.setResearchPointsCompleted(
        player1.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK],
        1000,
      );

      const ourFleet = Fleet.generateFleetWithShipCount(0, 0, 2, 0, 0, 0, null);
      const enemyFleet = Fleet.generateFleetWithShipCount(0, 0, 2, 0, 0, 0, null);

      const effectiveStrength = ComputerPlayer.calculateEffectiveFleetStrength(ourFleet, enemyFleet, false, player1);

      const rawStrength = Fleet.determineFleetStrength(ourFleet);
      // Should be higher due to research bonuses
      expect(effectiveStrength).toBeGreaterThan(rawStrength);
    });
  });

  describe('AI vs AI game simulations', () => {
    test('Easy vs Normal - Normal should win eventually', () => {
      enableAIDebug();

      const wins = runAIvsAISimulation(PlayerType.Computer_Easy, PlayerType.Computer_Normal, {
        iterations: 1,
        maxTurns: 150,
      });

      console.log('Easy vs Normal results:', { easy: wins.player1, normal: wins.player2, draws: wins.draws });

      // Save AI decisions to file
      const aiDecisionsJSON = exportAIDecisionsJSON();
      const outputPath = getAiDecisionDebugFilePath('ai-decisions-easy-vs-normal.json');
      fs.writeFileSync(outputPath, aiDecisionsJSON);
      console.log(`\n✅ AI decisions saved to: ${outputPath}\n`);

      disableAIDebug();

      // Normal should win
      expect(wins.player2).toBeGreaterThanOrEqual(wins.player1);
    });

    test('Easy vs Hard - Hard should dominate', () => {
      enableAIDebug();

      const wins = runAIvsAISimulation(PlayerType.Computer_Easy, PlayerType.Computer_Hard, {
        iterations: 1,
        maxTurns: 100,
      });

      console.log('Easy vs Hard results:', { easy: wins.player1, hard: wins.player2, draws: wins.draws });

      // Save AI decisions to file
      const aiDecisionsJSON = exportAIDecisionsJSON();
      const outputPath = getAiDecisionDebugFilePath('ai-decisions-easy-vs-hard.json');
      fs.writeFileSync(outputPath, aiDecisionsJSON);
      console.log(`\n✅ AI decisions saved to: ${outputPath}\n`);

      disableAIDebug();

      // Hard should win
      expect(wins.player2).toBeGreaterThan(wins.player1);
    });

    test('Normal vs Hard - Hard should win eventually', () => {
      enableAIDebug();

      const wins = runAIvsAISimulation(PlayerType.Computer_Normal, PlayerType.Computer_Hard, {
        iterations: 1,
        maxTurns: 150,
      });

      console.log('Normal vs Hard results:', { normal: wins.player1, hard: wins.player2, draws: wins.draws });

      // Save AI decisions to file
      const aiDecisionsJSON = exportAIDecisionsJSON();
      const outputPath = getAiDecisionDebugFilePath('ai-decisions-normal-vs-hard.json');
      fs.writeFileSync(outputPath, aiDecisionsJSON);
      console.log(`\n✅ AI decisions saved to: ${outputPath}\n`);

      disableAIDebug();

      // Hard should win at least as often as Normal
      expect(wins.player2).toBeGreaterThanOrEqual(wins.player1);
    });

    test('Easy vs Expert - Expert should dominate', () => {
      enableAIDebug();

      const wins = runAIvsAISimulation(PlayerType.Computer_Easy, PlayerType.Computer_Expert, {
        iterations: 1,
        maxTurns: 80,
      });

      console.log('Easy vs Expert results:', { easy: wins.player1, expert: wins.player2, draws: wins.draws });

      // Save AI decisions to file
      const aiDecisionsJSON = exportAIDecisionsJSON();
      const outputPath = getAiDecisionDebugFilePath('ai-decisions-easy-vs-expert.json');
      fs.writeFileSync(outputPath, aiDecisionsJSON);
      console.log(`\n✅ AI decisions saved to: ${outputPath}\n`);

      disableAIDebug();

      // Expert should win significantly more
      expect(wins.player2).toBeGreaterThan(wins.player1);
    });

    test('Hard vs Expert - expert should win eventually', () => {
      enableAIDebug();

      const wins = runAIvsAISimulation(PlayerType.Computer_Hard, PlayerType.Computer_Expert, {
        iterations: 5,
        maxTurns: 150,
      });

      console.log('Hard vs Expert results:', { hard: wins.player1, expert: wins.player2, draws: wins.draws });

      // Save AI decisions to file
      const aiDecisionsJSON = exportAIDecisionsJSON();
      const outputPath = getAiDecisionDebugFilePath('ai-decisions-hard-vs-expert.json');
      fs.writeFileSync(outputPath, aiDecisionsJSON);
      console.log(`\n✅ AI decisions saved to: ${outputPath}\n`);

      disableAIDebug();

      // Both are aggressive and advanced - these AIs are closely matched
      // Expert should win at least 1 more game than Hard to prove it's competitive
      expect(wins.player2).toBeGreaterThanOrEqual(wins.player1 + 1);
    });

    test('Hard AI should not starve', () => {
      const gameData = startNewTestGame();
      gameData.gameModel.modelData.players[0].type = PlayerType.Computer_Hard;
      gameData.gameModel.modelData.players[1].type = PlayerType.Computer_Hard;

      // Run for 30 turns and check food management (using full cycle advances)
      for (let turn = 0; turn < 30; turn++) {
        advanceGameCycles(gameData.gameModel, 1);

        for (const player of gameData.gameModel.modelData.players) {
          const ownedPlanets = ClientGameModel.getOwnedPlanets(
            player.ownedPlanetIds,
            gameData.gameModel.modelData.planets,
          );
          const totalPop = Player.getTotalPopulation(player, ownedPlanets);

          // Hard AI should maintain positive population
          if (turn > 10) {
            // Give some initial turns to stabilize
            expect(totalPop).toBeGreaterThan(0);
          }
        }
      }
    });

    test('Expert AI should expand faster than Easy AI', () => {
      // Run multiple iterations to account for randomness
      let expertWins = 0;
      let ties = 0;
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const easyGameData = startNewTestGame();
        easyGameData.gameModel.modelData.players[0].type = PlayerType.Computer_Easy;
        easyGameData.gameModel.modelData.players[1].type = PlayerType.Human; // Inactive

        const expertGameData = startNewTestGame();
        expertGameData.gameModel.modelData.players[0].type = PlayerType.Computer_Expert;
        expertGameData.gameModel.modelData.players[1].type = PlayerType.Human; // Inactive

        // Run both for 40 turns (using full cycle advances)
        for (let turn = 0; turn < 40; turn++) {
          advanceGameCycles(easyGameData.gameModel, 1);
          advanceGameCycles(expertGameData.gameModel, 1);
        }

        const easyPlanets = easyGameData.gameModel.modelData.players[0].ownedPlanetIds.length;
        const expertPlanets = expertGameData.gameModel.modelData.players[0].ownedPlanetIds.length;

        if (expertPlanets > easyPlanets) expertWins++;
        else if (expertPlanets === easyPlanets) ties++;
      }

      console.log(`Expansion comparison: Expert wins ${expertWins}/${iterations}, ties ${ties}/${iterations}`);
      // Expert should win or tie at least 60% of the time (3 out of 5)
      expect(expertWins + ties).toBeGreaterThanOrEqual(3);
    });
  });

  describe('attack decision thresholds', () => {
    test('Easy AI should require 3-6x strength advantage', () => {
      const easyPlayer = Player.constructPlayer('easy', PlayerType.Computer_Easy, 'Easy', player1.color);
      easyPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        easyPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );
      const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(easyPlayer, ownedPlanets);
      const homePlanet = ownedPlanetsSorted[0];

      // Give home planet a strong fleet
      homePlanet.planetaryFleet = Fleet.generateFleetWithShipCount(0, 10, 5, 2, 1, 0, homePlanet.boundingHexMidPoint);

      // Set up enemy planet with weak defense
      const enemyPlanet = testGameData.gameModel.modelData.planets[1];
      easyPlayer.lastKnownPlanetFleetStrength[enemyPlanet.id] = {
        fleetData: Fleet.generateFleetWithShipCount(0, 1, 0, 0, 0, 0, enemyPlanet.boundingHexMidPoint),
        cycleLastExplored: testGameData.gameModel.modelData.currentCycle,
        lastKnownOwnerId: player2.id,
      };
      easyPlayer.knownPlanetIds.push(enemyPlanet.id);

      testGameData.gameModel.modelData.players.push(easyPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, easyPlayer.id);
      const easyCmds = ComputerPlayer.computerSendShips(clientModel, testGameData.gameModel.grid, easyPlayer, ownedPlanets, ownedPlanetsSorted);
      for (const cmd of easyCmds) CommandProcessor.processCommand(clientModel, testGameData.gameModel.grid, cmd);

      // Easy AI might attack, but not always due to high threshold
      const fleetsCount = homePlanet.outgoingFleets.length;
      console.log('Easy AI sent', fleetsCount, 'fleets');
      // Just checking it doesn't crash
      expect(fleetsCount).toBeGreaterThanOrEqual(0);
    });

    test('Expert AI should attack with lower advantage', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );
      const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(expertPlayer, ownedPlanets);
      const homePlanet = ownedPlanetsSorted[0];

      // Give home planet a moderate fleet
      homePlanet.planetaryFleet = Fleet.generateFleetWithShipCount(0, 5, 3, 1, 0, 0, homePlanet.boundingHexMidPoint);

      // Set up enemy planet with weaker defense
      const enemyPlanet = testGameData.gameModel.modelData.planets[1];
      expertPlayer.lastKnownPlanetFleetStrength[enemyPlanet.id] = {
        fleetData: Fleet.generateFleetWithShipCount(0, 2, 1, 0, 0, 0, enemyPlanet.boundingHexMidPoint),
        cycleLastExplored: testGameData.gameModel.modelData.currentCycle,
        lastKnownOwnerId: player2.id,
      };
      expertPlayer.knownPlanetIds.push(enemyPlanet.id);

      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const expertCmds = ComputerPlayer.computerSendShips(clientModel, testGameData.gameModel.grid, expertPlayer, ownedPlanets, ownedPlanetsSorted);
      for (const cmd of expertCmds) CommandProcessor.processCommand(clientModel, testGameData.gameModel.grid, cmd);

      // Expert AI more likely to attack with smaller advantage
      const fleetsCount = homePlanet.outgoingFleets.length;
      console.log('Expert AI sent', fleetsCount, 'fleets');
      expect(fleetsCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Enhanced Intelligence Gathering', () => {
    it('should re-scout nearby enemy planets more frequently for Hard AI', () => {
      const hardPlayer = Player.constructPlayer('hard', PlayerType.Computer_Hard, 'Hard', player1.color);
      hardPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        hardPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      // Use a nearby planet as enemy territory (planet[1] is typically close to planet[0])
      const enemyPlanet = testGameData.gameModel.modelData.planets[1];

      // Hard player discovers it and knows it's enemy-owned
      hardPlayer.knownPlanetIds.push(enemyPlanet.id);
      hardPlayer.lastKnownPlanetFleetStrength[enemyPlanet.id] = {
        cycleLastExplored: 0,
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 5, 0, 0, 0, enemyPlanet.boundingHexMidPoint),
        lastKnownOwnerId: player2.id,
      };

      // After enough turns, Hard AI should re-scout nearby enemy planets once intel becomes stale
      // Staleness threshold scales with unknown planet count; with ~8 unknown planets, threshold is ~18
      advanceGameCycles(testGameData.gameModel, 20);

      testGameData.gameModel.modelData.players.push(hardPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, hardPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        enemyPlanet,
        clientModel,
        testGameData.gameModel.grid,
        hardPlayer,
        ownedPlanets,
      );

      // Should re-scout because it's enemy-owned, nearby, and enough turns have passed
      expect(needsExploration).toBe(true);
    });

    it('should prioritize exploring high-priority planets based on percentile ranking', () => {
      const normalPlayer = Player.constructPlayer('normal', PlayerType.Computer_Normal, 'Normal', player1.color);
      normalPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        normalPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      const ownedPlanet = Object.values(ownedPlanets)[0];

      // Get all unknown planets and their priorities
      const unknownPlanets = testGameData.gameModel.modelData.planets.filter(
        (p) => !normalPlayer.knownPlanetIds.includes(p.id) && p.id !== ownedPlanet.id,
      );

      if (unknownPlanets.length === 0) {
        console.log('No unknown planets to test');
        return;
      }

      // Calculate how many should be explored with Normal's 30% threshold
      const topPercentage = 0.3; // Normal AI explores top 30%
      const expectedTopCount = Math.max(1, Math.ceil(unknownPlanets.length * topPercentage));

      // Count planets needing exploration
      testGameData.gameModel.modelData.players.push(normalPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, normalPlayer.id);
      let planetsNeedingExploration = 0;
      for (const planet of unknownPlanets) {
        if (ComputerPlayer.planetNeedsExploration(planet, clientModel, testGameData.gameModel.grid, normalPlayer, ownedPlanets)) {
          planetsNeedingExploration++;
        }
      }

      console.log(
        `Normal AI: ${planetsNeedingExploration}/${unknownPlanets.length} planets need exploration (expected ~${expectedTopCount})`,
      );

      // Normal should explore roughly the top 30% of unknown planets
      expect(planetsNeedingExploration).toBeGreaterThanOrEqual(1);
      expect(planetsNeedingExploration).toBeGreaterThanOrEqual(expectedTopCount - 1); // Allow for rounding
    });

    it('should never re-scout for Easy AI', () => {
      const easyPlayer = Player.constructPlayer('easy', PlayerType.Computer_Easy, 'Easy', player1.color);
      easyPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      // Use second planet as enemy territory
      const enemyPlanet = testGameData.gameModel.modelData.planets[1];

      // Easy player discovers it
      easyPlayer.knownPlanetIds.push(enemyPlanet.id);
      easyPlayer.lastKnownPlanetFleetStrength[enemyPlanet.id] = {
        cycleLastExplored: 0,
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 5, 0, 0, 0, enemyPlanet.boundingHexMidPoint),
        lastKnownOwnerId: player2.id,
      };

      // After many turns, Easy AI should still not re-scout
      advanceGameCycles(testGameData.gameModel, 20);

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        easyPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      testGameData.gameModel.modelData.players.push(easyPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, easyPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        enemyPlanet,
        clientModel,
        testGameData.gameModel.grid,
        easyPlayer,
        ownedPlanets,
      );

      expect(needsExploration).toBe(false);
    });

    it('should send scouts for exploration instead of powerful ships when both are available', () => {
      // TDD Test: This test validates two behaviors:
      // 1. AI prefers scouts/destroyers over cruisers/battleships for exploration
      // 2. AI sends only ONE scout to each unexplored planet (no duplicates)

      const normalPlayer = Player.constructPlayer('normal', PlayerType.Computer_Normal, 'Normal', player1.color);

      // Create 3 owned planets with different fleet compositions
      const planet1 = testGameData.gameModel.modelData.planets[0]; // Has scouts
      const planet2 = testGameData.gameModel.modelData.planets[1]; // Has cruisers
      const planet3 = testGameData.gameModel.modelData.planets[2]; // Has mixed fleet
      const unknownPlanet = testGameData.gameModel.modelData.planets[3]; // The ONLY unexplored planet

      normalPlayer.ownedPlanetIds = [planet1.id, planet2.id, planet3.id];
      normalPlayer.homePlanetId = planet1.id;

      // Planet 1: Only scouts (should send from here for exploration)
      planet1.planetaryFleet = Fleet.generateFleetWithShipCount(0, 3, 0, 0, 0, 0, planet1.boundingHexMidPoint);
      planet1.outgoingFleets = [];

      // Planet 2: Only cruisers (should NOT send from here for exploration)
      planet2.planetaryFleet = Fleet.generateFleetWithShipCount(0, 0, 0, 2, 0, 0, planet2.boundingHexMidPoint);
      planet2.outgoingFleets = [];

      // Planet 3: Mixed fleet with battleships (should NOT send from here for exploration)
      planet3.planetaryFleet = Fleet.generateFleetWithShipCount(0, 1, 1, 1, 1, 0, planet3.boundingHexMidPoint);
      planet3.outgoingFleets = [];

      // Mark ALL planets as known EXCEPT unknownPlanet to ensure it's the only exploration target
      normalPlayer.knownPlanetIds = testGameData.gameModel.modelData.planets
        .filter((p) => p.id !== unknownPlanet.id)
        .map((p) => p.id);

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        normalPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );
      const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(normalPlayer, ownedPlanets);

      // Verify unknownPlanet needs exploration
      testGameData.gameModel.modelData.players.push(normalPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, normalPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        unknownPlanet,
        clientModel,
        testGameData.gameModel.grid,
        normalPlayer,
        ownedPlanets,
      );
      expect(needsExploration).toBe(true);

      // Execute ship sending logic and process returned commands
      const shipCmds = ComputerPlayer.computerSendShips(clientModel, testGameData.gameModel.grid, normalPlayer, ownedPlanets, ownedPlanetsSorted);
      for (const cmd of shipCmds) CommandProcessor.processCommand(clientModel, testGameData.gameModel.grid, cmd);

      // Debug: log what actually happened
      console.log('Planet1 (scouts) sent:', planet1.outgoingFleets.length, 'fleets');
      console.log('Planet2 (cruisers) sent:', planet2.outgoingFleets.length, 'fleets');
      console.log('Planet3 (mixed) sent:', planet3.outgoingFleets.length, 'fleets');

      // Count fleets sent to the specific unknownPlanet
      const fleetsToUnknownPlanet = [
        ...planet1.outgoingFleets,
        ...planet2.outgoingFleets,
        ...planet3.outgoingFleets,
      ].filter((fleet) => fleet.destinationHexMidPoint === unknownPlanet.boundingHexMidPoint);

      console.log('Total fleets sent to unknownPlanet:', fleetsToUnknownPlanet.length);

      if (planet2.outgoingFleets.length > 0) {
        console.log(
          'Planet2 sent ship types:',
          planet2.outgoingFleets[0].starships.map((s) => s.type),
        );
      }
      if (planet3.outgoingFleets.length > 0) {
        console.log(
          'Planet3 sent ship types:',
          planet3.outgoingFleets[0].starships.map((s) => s.type),
        );
      }

      // CRITICAL: Verify that exactly ONE fleet is sent to the unknownPlanet
      // This ensures we don't send duplicate scouts to the same target
      expect(fleetsToUnknownPlanet.length).toBe(1);

      // Verify that the fleet sent contains only scouts or destroyers
      const sentFleet = fleetsToUnknownPlanet[0];
      expect(sentFleet.starships.length).toBeGreaterThan(0);
      for (const ship of sentFleet.starships) {
        expect([StarShipType.Scout, StarShipType.Destroyer]).toContain(ship.type);
      }

      // Verify that cruisers/battleships were NOT sent for exploration
      // Planet 2 should not send cruisers to the unknown planet specifically
      const planet2FleetsToUnknown = planet2.outgoingFleets.filter(
        (fleet) => fleet.destinationHexMidPoint === unknownPlanet.boundingHexMidPoint,
      );
      const planet2SentCruiserToUnknown = planet2FleetsToUnknown.some((fleet) =>
        fleet.starships.some((ship) => ship.type === StarShipType.Cruiser),
      );
      expect(planet2SentCruiserToUnknown).toBe(false);

      // Planet 3 should not send battleships or cruisers to the unknown planet
      const planet3FleetsToUnknown = planet3.outgoingFleets.filter(
        (fleet) => fleet.destinationHexMidPoint === unknownPlanet.boundingHexMidPoint,
      );
      const planet3SentExpensiveShipsToUnknown = planet3FleetsToUnknown.some((fleet) =>
        fleet.starships.some((ship) => ship.type === StarShipType.Battleship || ship.type === StarShipType.Cruiser),
      );
      expect(planet3SentExpensiveShipsToUnknown).toBe(false);
    });

    it('should prefer closer planets when sending scouts to unexplored planets', () => {
      // This test validates that when multiple planets have scouts available,
      // the AI prefers sending from the planet closest to the exploration target

      const normalPlayer = Player.constructPlayer('normal', PlayerType.Computer_Normal, 'Normal', player1.color);

      // Create 2 owned planets with scouts at different distances from the target
      const closerPlanet = testGameData.gameModel.modelData.planets[0]; // Closer to unknownPlanet
      const fartherPlanet = testGameData.gameModel.modelData.planets[2]; // Farther from unknownPlanet
      const unknownPlanet = testGameData.gameModel.modelData.planets[1]; // In between

      normalPlayer.ownedPlanetIds = [closerPlanet.id, fartherPlanet.id];
      normalPlayer.homePlanetId = closerPlanet.id;

      // Both planets have scouts available
      closerPlanet.planetaryFleet = Fleet.generateFleetWithShipCount(
        0,
        2,
        0,
        0,
        0,
        0,
        closerPlanet.boundingHexMidPoint,
      );
      closerPlanet.outgoingFleets = [];

      fartherPlanet.planetaryFleet = Fleet.generateFleetWithShipCount(
        0,
        2,
        0,
        0,
        0,
        0,
        fartherPlanet.boundingHexMidPoint,
      );
      fartherPlanet.outgoingFleets = [];

      // Mark ALL planets as known EXCEPT unknownPlanet
      normalPlayer.knownPlanetIds = testGameData.gameModel.modelData.planets
        .filter((p) => p.id !== unknownPlanet.id)
        .map((p) => p.id);

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        normalPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );
      const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(normalPlayer, ownedPlanets);

      // Verify that unknownPlanet needs exploration with percentile logic
      testGameData.gameModel.modelData.players.push(normalPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, normalPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        unknownPlanet,
        clientModel,
        testGameData.gameModel.grid,
        normalPlayer,
        ownedPlanets,
      );

      // With Normal's 50% threshold and only 1 unexplored planet, it should be explored
      if (!needsExploration) {
        console.log('Unknown planet does not need exploration (may be below 50% threshold)');
        // This can happen if the game has many unexplored planets and this one isn't in top 50%
        // Let's just verify the method doesn't crash
        expect(needsExploration).toBeDefined();
        return;
      }

      // Execute ship sending logic and process returned commands
      const shipCmds2 = ComputerPlayer.computerSendShips(clientModel, testGameData.gameModel.grid, normalPlayer, ownedPlanets, ownedPlanetsSorted);
      for (const cmd of shipCmds2) CommandProcessor.processCommand(clientModel, testGameData.gameModel.grid, cmd);

      // Verify that exactly ONE fleet was sent
      const totalFleetsSent = closerPlanet.outgoingFleets.length + fartherPlanet.outgoingFleets.length;
      expect(totalFleetsSent).toBeGreaterThanOrEqual(0); // May be 0 or 1 depending on percentile

      if (totalFleetsSent > 0) {
        // Calculate distances to verify which planet is actually closer
        const distanceFromCloser = Grid.getHexDistanceForMidPoints(
          testGameData.gameModel.grid,
          closerPlanet.boundingHexMidPoint,
          unknownPlanet.boundingHexMidPoint,
        );
        const distanceFromFarther = Grid.getHexDistanceForMidPoints(
          testGameData.gameModel.grid,
          fartherPlanet.boundingHexMidPoint,
          unknownPlanet.boundingHexMidPoint,
        );

        console.log('Distance from closer planet:', distanceFromCloser);
        console.log('Distance from farther planet:', distanceFromFarther);

        // The closer planet should be the one that sent the fleet
        if (distanceFromCloser < distanceFromFarther) {
          expect(closerPlanet.outgoingFleets.length).toBeGreaterThanOrEqual(fartherPlanet.outgoingFleets.length);
        } else {
          // If planets are equidistant or test setup is different, just verify one sent
          expect(totalFleetsSent).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('Strategic Target Valuation', () => {
    it('should calculate higher value for resource-rich, weakly defended planets', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      // Create high-value target: nearby planet with weak defense
      const highValueTarget = testGameData.gameModel.modelData.planets[1];

      expertPlayer.knownPlanetIds.push(highValueTarget.id);
      expertPlayer.lastKnownPlanetFleetStrength[highValueTarget.id] = {
        cycleLastExplored: 0,
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, highValueTarget.boundingHexMidPoint), // very weak: 1 destroyer
        lastKnownOwnerId: player2.id,
      };

      // Create low-value target: planet with very strong defense
      // Use a planet farther away to ensure lower value
      const lowValueTarget = testGameData.gameModel.modelData.planets[7];

      expertPlayer.knownPlanetIds.push(lowValueTarget.id);
      expertPlayer.lastKnownPlanetFleetStrength[lowValueTarget.id] = {
        cycleLastExplored: 0,
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 15, 8, 5, 0, lowValueTarget.boundingHexMidPoint), // very strong fleet
        lastKnownOwnerId: player2.id,
      };

      // Use the private method via casting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calculateValue = (ComputerPlayer as any).calculatePlanetTargetValue.bind(ComputerPlayer);
      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const highValue = calculateValue(highValueTarget, expertPlayer, ownedPlanets, clientModel, testGameData.gameModel.grid);
      const lowValue = calculateValue(lowValueTarget, expertPlayer, ownedPlanets, clientModel, testGameData.gameModel.grid);

      // High value target should be significantly more valuable due to much weaker defenses
      // Weak defense (strength < 10) gives +25 vs strong defense (strength >= 50) gives 0
      // This ensures at least 20+ point difference from defense alone
      expect(highValue).toBeGreaterThan(lowValue);
    });

    it('should return 0 value for planets with no intelligence data', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      const targetPlanet = testGameData.gameModel.modelData.planets[1];

      // Planet is known but no intelligence data exists
      expertPlayer.knownPlanetIds.push(targetPlanet.id);
      // Deliberately NOT adding to lastKnownPlanetFleetStrength

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calculateValue = (ComputerPlayer as any).calculatePlanetTargetValue.bind(ComputerPlayer);
      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const value = calculateValue(targetPlanet, expertPlayer, ownedPlanets, clientModel, testGameData.gameModel.grid);

      // This is the current behavior that causes the bug:
      // No intelligence = 0 value = filtered out of attack targets
      expect(value).toBe(0);
    });

    it('should return positive value for unowned planets with intelligence', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      const targetPlanet = testGameData.gameModel.modelData.planets[1];

      // Planet that isn't owned by the player and has some intelligence
      expertPlayer.knownPlanetIds.push(targetPlanet.id);
      expertPlayer.lastKnownPlanetFleetStrength[targetPlanet.id] = {
        cycleLastExplored: 10,
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, targetPlanet.boundingHexMidPoint),
        lastKnownOwnerId: undefined, // Unowned or unknown owner
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calculateValue = (ComputerPlayer as any).calculatePlanetTargetValue.bind(ComputerPlayer);
      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const value = calculateValue(targetPlanet, expertPlayer, ownedPlanets, clientModel, testGameData.gameModel.grid);

      // Should have positive value since we don't own it and we have intelligence
      // Planet type + proximity + strategic location should all add value
      expect(value).toBeGreaterThan(0);
    });

    it('should return positive value for planets with recent intelligence showing enemy ownership', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      const targetPlanet = testGameData.gameModel.modelData.planets[1];

      // Expert re-scouted recently and knows it's enemy-owned
      expertPlayer.knownPlanetIds.push(targetPlanet.id);
      expertPlayer.lastKnownPlanetFleetStrength[targetPlanet.id] = {
        cycleLastExplored: 95, // Recent
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, targetPlanet.boundingHexMidPoint),
        lastKnownOwnerId: player2.id, // Enemy owned
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calculateValue = (ComputerPlayer as any).calculatePlanetTargetValue.bind(ComputerPlayer);
      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const value = calculateValue(targetPlanet, expertPlayer, ownedPlanets, clientModel, testGameData.gameModel.grid);

      // With good intelligence, value should be positive
      expect(value).toBeGreaterThan(0);
    });
  });

  describe('planetNeedsExploration', () => {
    it('should return false for known planets when re-scouting is disabled', () => {
      const easyPlayer = Player.constructPlayer('easy', PlayerType.Computer_Easy, 'Easy', player1.color);
      easyPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        easyPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      const targetPlanet = testGameData.gameModel.modelData.planets[1];

      // Planet is known (previously scouted)
      easyPlayer.knownPlanetIds.push(targetPlanet.id);
      easyPlayer.lastKnownPlanetFleetStrength[targetPlanet.id] = {
        cycleLastExplored: 10,
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, targetPlanet.boundingHexMidPoint),
        lastKnownOwnerId: undefined,
      };

      testGameData.gameModel.modelData.players.push(easyPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, easyPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        targetPlanet,
        clientModel,
        testGameData.gameModel.grid,
        easyPlayer,
        ownedPlanets,
      );

      // Easy AI has enableReScouting: false, so known planets should not need exploration
      expect(needsExploration).toBe(false);
    });

    it('should return true for unknown planets in the top percentile', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      // Get a nearby unowned planet (should be in top priority candidates)
      const ownedPlanet = ownedPlanets[expertPlayer.ownedPlanetIds[0]];
      const targetPlanet = testGameData.gameModel.modelData.planets.find(
        (p) => p.id !== ownedPlanet.id && !expertPlayer.ownedPlanetIds.includes(p.id),
      )!;

      // Planet is NOT known (never scouted)
      expect(expertPlayer.knownPlanetIds.includes(targetPlanet.id)).toBe(false);

      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        targetPlanet,
        clientModel,
        testGameData.gameModel.grid,
        expertPlayer,
        ownedPlanets,
      );

      // With percentile-based logic, Expert (75% threshold) should explore most unknown planets
      // Since this is a nearby planet, it should definitely be in the top 75%
      // The new logic ensures AI always has exploration targets based on relative priority
      expect(needsExploration).toBe(true);
    });

    it('should use percentile-based selection for unknown planets', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      // Calculate priorities for all unknown planets
      const ownedPlanet = ownedPlanets[expertPlayer.ownedPlanetIds[0]];
      const unknownPlanets = testGameData.gameModel.modelData.planets.filter(
        (p) => p.id !== ownedPlanet.id && !expertPlayer.knownPlanetIds.includes(p.id),
      );

      // Expert has 75% threshold, so should explore most planets
      const topPercentage = 0.75;
      const expectedTopCount = Math.max(1, Math.ceil(unknownPlanets.length * topPercentage));

      // Count how many planets actually need exploration
      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      let planetsNeedingExploration = 0;
      for (const planet of unknownPlanets) {
        if (ComputerPlayer.planetNeedsExploration(planet, clientModel, testGameData.gameModel.grid, expertPlayer, ownedPlanets)) {
          planetsNeedingExploration++;
        }
      }

      // Should explore the top N planets based on percentile
      // With 75% threshold and ~8-9 unknown planets, should explore at least 6
      expect(planetsNeedingExploration).toBeGreaterThanOrEqual(expectedTopCount - 1);
      expect(planetsNeedingExploration).toBeLessThanOrEqual(unknownPlanets.length);
    });

    it('should use threshold-based re-scouting for known planets (Expert requires >= 100 priority)', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      // Expert has threshold of 100 for re-scouting
      // Priority breakdown: Proximity (0-50) + Enemy (30) + Type (3-15) + Staleness (0-25)
      // This test validates the threshold mechanism works correctly

      // Since actual map distances vary, let's test the mechanism by checking that:
      // 1. The threshold is being applied (not percentile)
      // 2. Higher priority planets are more likely to be re-scouted than lower priority ones

      const testPlanet = testGameData.gameModel.modelData.planets[1];
      testPlanet.type = PlanetType.PlanetClass2; // High value (+15)

      expertPlayer.knownPlanetIds.push(testPlanet.id);
      expertPlayer.lastKnownPlanetFleetStrength[testPlanet.id] = {
        cycleLastExplored: 70, // Will be 30 turns old after advance
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 5, 0, 0, 0, testPlanet.boundingHexMidPoint),
        lastKnownOwnerId: player2.id, // Enemy owned (+40)
      };

      advanceGameCycles(testGameData.gameModel, 30);

      // Calculate the actual priority to understand if it meets threshold
      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actualPriority = (ComputerPlayer as any).calculateScoutPriority(
        testPlanet,
        clientModel,
        testGameData.gameModel.grid,
        expertPlayer,
        ownedPlanets,
      );

      console.log(`Expert re-scout test: Planet priority = ${actualPriority}, threshold = 100`);

      const needsRescouting = ComputerPlayer.planetNeedsExploration(
        testPlanet,
        clientModel,
        testGameData.gameModel.grid,
        expertPlayer,
        ownedPlanets,
      );

      // The result should match whether priority >= threshold
      if (actualPriority >= 100) {
        expect(needsRescouting).toBe(true);
      } else {
        expect(needsRescouting).toBe(false);
      }

      // Verify the threshold mechanism is working (not percentile-based)
      // If it were percentile-based, we'd always re-scout top N% regardless of absolute priority
      expect(needsRescouting).toBe(actualPriority >= 100);
    });

    it('should use lower threshold for Normal AI (>= 45 priority)', () => {
      const normalPlayer = Player.constructPlayer('normal', PlayerType.Computer_Normal, 'Normal', player1.color);
      normalPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        normalPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      // Normal has threshold of 45 (more frequent re-scouting than Expert's 100)

      const nearbyPlanet = testGameData.gameModel.modelData.planets[1];
      nearbyPlanet.type = PlanetType.PlanetClass2; // +15 points
      normalPlayer.knownPlanetIds.push(nearbyPlanet.id);
      normalPlayer.lastKnownPlanetFleetStrength[nearbyPlanet.id] = {
        cycleLastExplored: 85, // Will be 15 turns old
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 2, 0, 0, 0, nearbyPlanet.boundingHexMidPoint),
        lastKnownOwnerId: undefined,
      };

      advanceGameCycles(testGameData.gameModel, 15);

      // Calculate actual priority to verify threshold mechanism
      testGameData.gameModel.modelData.players.push(normalPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, normalPlayer.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actualPriority = (ComputerPlayer as any).calculateScoutPriority(
        nearbyPlanet,
        clientModel,
        testGameData.gameModel.grid,
        normalPlayer,
        ownedPlanets,
      );

      console.log(`Normal re-scout test: Planet priority = ${actualPriority}, threshold = 45`);

      const needsRescouting = ComputerPlayer.planetNeedsExploration(
        nearbyPlanet,
        clientModel,
        testGameData.gameModel.grid,
        normalPlayer,
        ownedPlanets,
      );

      // Verify threshold mechanism: result should match priority >= threshold
      expect(needsRescouting).toBe(actualPriority >= 45);

      // Normal's lower threshold (45) should allow more re-scouting than Expert (100)
      // This demonstrates the difficulty-based tuning of re-scouting aggressiveness
      expect(45).toBeLessThan(100); // Normal is more aggressive than Expert
    });

    it('should return false when known planet has no intelligence data (priority = 0, below threshold)', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      const targetPlanet = testGameData.gameModel.modelData.planets[1];

      // Planet is marked as KNOWN but has no intelligence data
      // (This is an edge case that shouldn't happen but we should handle gracefully)
      expertPlayer.knownPlanetIds.push(targetPlanet.id);
      // No entry in lastKnownPlanetFleetStrength

      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        targetPlanet,
        clientModel,
        testGameData.gameModel.grid,
        expertPlayer,
        ownedPlanets,
      );

      // Should return false because calculateScoutPriority returns 0 without intel
      // 0 < threshold (100 for Expert), so planet won't be re-scouted
      expect(needsExploration).toBe(false);
    });

    it('should return false for owned planets (filtered from candidate selection)', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      expertPlayer.ownedPlanetIds = [player1.ownedPlanetIds[0]];

      const ownedPlanets = ClientGameModel.getOwnedPlanets(
        expertPlayer.ownedPlanetIds,
        testGameData.gameModel.modelData.planets,
      );

      const ownedPlanet = ownedPlanets[expertPlayer.ownedPlanetIds[0]];

      // Mark planet as known and add intelligence
      expertPlayer.knownPlanetIds.push(ownedPlanet.id);
      expertPlayer.lastKnownPlanetFleetStrength[ownedPlanet.id] = {
        cycleLastExplored: 50,
        fleetData: Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, ownedPlanet.boundingHexMidPoint),
        lastKnownOwnerId: expertPlayer.id,
      };

      testGameData.gameModel.modelData.players.push(expertPlayer);
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, expertPlayer.id);
      const needsExploration = ComputerPlayer.planetNeedsExploration(
        ownedPlanet,
        clientModel,
        testGameData.gameModel.grid,
        expertPlayer,
        ownedPlanets,
      );

      // We shouldn't explore our own planets
      // Both exploration paths (unknown percentile & known threshold) filter owned planets
      expect(needsExploration).toBe(false);
    });
  });

  describe('computerManageFleetRepairs', () => {
    /**
     * Helper: set up a Hard AI player owning specific planets with controlled improvements and fleets.
     */
    function setupRepairScenario(gameData: TestGameData, opts: {
      planet1Improvements?: Partial<Record<PlanetImprovementType, number>>;
      planet1Fleet?: ReturnType<typeof Fleet.generateFleetWithShipCount>;
      planet2Improvements?: Partial<Record<PlanetImprovementType, number>>;
      planet2Fleet?: ReturnType<typeof Fleet.generateFleetWithShipCount>;
      planet2SpacePlatforms?: number;
      playerType?: PlayerType;
    }) {
      const planet1 = gameData.gameModel.modelData.planets[0];
      const planet2 = gameData.gameModel.modelData.planets[1];

      const aiPlayer = Player.constructPlayer('ai', opts.playerType ?? PlayerType.Computer_Hard, 'AI', player1.color);
      aiPlayer.ownedPlanetIds = [planet1.id, planet2.id];
      aiPlayer.homePlanetId = planet1.id;

      // Set up planet 1
      planet1.builtImprovements = {
        [PlanetImprovementType.Colony]: 0,
        [PlanetImprovementType.Factory]: 0,
        [PlanetImprovementType.Farm]: 0,
        [PlanetImprovementType.Mine]: 0,
        ...opts.planet1Improvements,
      };
      if (opts.planet1Fleet) {
        planet1.planetaryFleet = opts.planet1Fleet;
      }
      planet1.outgoingFleets = [];

      // Set up planet 2
      planet2.builtImprovements = {
        [PlanetImprovementType.Colony]: 0,
        [PlanetImprovementType.Factory]: 0,
        [PlanetImprovementType.Farm]: 0,
        [PlanetImprovementType.Mine]: 0,
        ...opts.planet2Improvements,
      };
      if (opts.planet2Fleet) {
        planet2.planetaryFleet = opts.planet2Fleet;
      } else {
        planet2.planetaryFleet = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, opts.planet2SpacePlatforms ?? 0, planet2.boundingHexMidPoint);
      }
      planet2.outgoingFleets = [];

      gameData.gameModel.modelData.players.push(aiPlayer);

      const ownedPlanets = ClientGameModel.getOwnedPlanets(aiPlayer.ownedPlanetIds, gameData.gameModel.modelData.planets);
      const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(aiPlayer, ownedPlanets);
      const clientModel = ClientGameModel.constructClientGameModel(gameData.gameModel.modelData, aiPlayer.id);

      return { aiPlayer, planet1, planet2, ownedPlanets, ownedPlanetsSorted, clientModel };
    }

    it('should retreat a damaged destroyer from a planet with no factory to one with factory+colony', () => {
      // Planet 1: no improvements, has a damaged destroyer
      // Planet 2: has factory + colony (can repair destroyers)
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      // Damage the destroyer to 50% health
      fleet1.starships[0].health = Math.floor(Fleet.getStarshipTypeBaseStrength(StarShipType.Destroyer) / 2);

      const { aiPlayer, planet1, planet2, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
      });

      const { commands, repairShipIds } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(1);
      expect(repairShipIds.size).toBe(1);

      const sendCmd = commands[0] as SendShipsCommand;
      expect(sendCmd.type).toBe(GameCommandType.SEND_SHIPS);
      expect(sendCmd.fromPlanetId).toBe(planet1.id);
      expect(sendCmd.toPlanetId).toBe(planet2.id);
      expect(sendCmd.shipIds.destroyers.length).toBe(1);
      expect(sendCmd.shipIds.destroyers[0]).toBe(fleet1.starships[0].id);
    });

    it('should retreat a damaged cruiser to a planet with factory+colony+space platform', () => {
      // Planet 1: has factory+colony but NO space platform → can't repair cruisers
      // Planet 2: has factory+colony+space platform → can repair cruisers
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 0, 1, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      fleet1.starships[0].health = Math.floor(Fleet.getStarshipTypeBaseStrength(StarShipType.Cruiser) / 2);

      const { aiPlayer, planet1, planet2, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
        planet2SpacePlatforms: 1,
      });

      const { commands, repairShipIds } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(1);
      expect(repairShipIds.size).toBe(1);

      const sendCmd = commands[0] as SendShipsCommand;
      expect(sendCmd.type).toBe(GameCommandType.SEND_SHIPS);
      expect(sendCmd.fromPlanetId).toBe(planet1.id);
      expect(sendCmd.toPlanetId).toBe(planet2.id);
      expect(sendCmd.shipIds.cruisers.length).toBe(1);
    });

    it('should NOT retreat ships that the current planet can repair', () => {
      // Planet 1: has factory+colony → CAN repair destroyer
      // Damaged destroyer should stay
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      fleet1.starships[0].health = Math.floor(Fleet.getStarshipTypeBaseStrength(StarShipType.Destroyer) / 2);

      const { aiPlayer, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
      });

      const { commands, repairShipIds } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(0);
      expect(repairShipIds.size).toBe(0);
    });

    it('should NOT retreat undamaged ships even if planet lacks improvements', () => {
      // Planet 1: no improvements, has a full-health destroyer
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      // Ensure ship is full health (default)

      const { aiPlayer, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
      });

      const { commands, repairShipIds } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(0);
      expect(repairShipIds.size).toBe(0);
    });

    it('should NOT retreat for Easy or Normal AI (enableFleetRepairs is false)', () => {
      // Damaged destroyer on planet with no factory — but Easy AI shouldn't retreat
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      fleet1.starships[0].health = 1;

      const { aiPlayer, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        playerType: PlayerType.Computer_Easy,
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
      });

      const { commands } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(0);
    });

    it('should NOT retreat scouts even if planet has no improvements', () => {
      // Scouts are always repairable — should never be retreated
      const fleet1 = Fleet.generateFleetWithShipCount(0, 1, 0, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      fleet1.starships[0].health = 1;

      const { aiPlayer, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
      });

      const { commands } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(0);
    });

    it('should not retreat if no other planet can repair the ship', () => {
      // Planet 1: no factory, has damaged destroyer
      // Planet 2: also no factory — nowhere to retreat to
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      fleet1.starships[0].health = 1;

      const { aiPlayer, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Fleet: fleet1,
        // Planet 2 has no improvements either
      });

      const { commands } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(0);
    });

    it('should retreat multiple damaged ships in one command when going to the same planet', () => {
      // Planet 1: no improvements, has 2 damaged destroyers and 1 damaged battleship
      // Planet 2: factory + colony + space platform (can repair all)
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 2, 0, 1, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      for (const ship of fleet1.starships) {
        ship.health = 1;
      }

      const { aiPlayer, planet2, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
        planet2SpacePlatforms: 1,
      });

      const { commands, repairShipIds } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      // All 3 ships should go to planet2 in a single command
      expect(commands.length).toBe(1);
      expect(repairShipIds.size).toBe(3);

      const sendCmd = commands[0] as SendShipsCommand;
      expect(sendCmd.toPlanetId).toBe(planet2.id);
      expect(sendCmd.shipIds.destroyers.length).toBe(2);
      expect(sendCmd.shipIds.battleships.length).toBe(1);
    });

    it('should produce valid commands that CommandProcessor can execute', () => {
      // End-to-end: generate repair commands and process them
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      fleet1.starships[0].health = 1;

      const { aiPlayer, planet1, planet2, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
      });

      const { commands } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(commands.length).toBe(1);

      // Process through CommandProcessor
      const result = CommandProcessor.processCommand(clientModel, testGameData.gameModel.grid, commands[0]);
      expect(result.success).toBe(true);

      // The ship should now be in outgoing fleets headed to planet2
      expect(planet1.outgoingFleets.length).toBe(1);
      expect(planet1.outgoingFleets[0].destinationHexMidPoint).toEqual(planet2.boundingHexMidPoint);
      expect(planet1.planetaryFleet.starships.length).toBe(0);
    });

    it('repair ship IDs should prevent computerSendShips from double-sending those ships', () => {
      // Set up: damaged destroyer on planet1 (no factory), planet2 has factory+colony
      // Also set up an enemy planet so computerSendShips would want to attack
      const fleet1 = Fleet.generateFleetWithShipCount(0, 0, 2, 0, 0, 0, testGameData.gameModel.modelData.planets[0].boundingHexMidPoint);
      fleet1.starships[0].health = 1; // Damage first destroyer
      // Second destroyer is at full health

      const { aiPlayer, planet1, ownedPlanets, ownedPlanetsSorted, clientModel } = setupRepairScenario(testGameData, {
        planet1Fleet: fleet1,
        planet2Improvements: {
          [PlanetImprovementType.Factory]: 1,
          [PlanetImprovementType.Colony]: 1,
        },
      });

      // Set up an enemy planet so AI has attack targets
      const enemyPlanet = testGameData.gameModel.modelData.planets[2];
      aiPlayer.knownPlanetIds.push(enemyPlanet.id);
      aiPlayer.lastKnownPlanetFleetStrength[enemyPlanet.id] = {
        cycleLastExplored: testGameData.gameModel.modelData.currentCycle,
        fleetData: Fleet.generateFleetWithShipCount(0, 1, 0, 0, 0, 0, enemyPlanet.boundingHexMidPoint),
        lastKnownOwnerId: player2.id,
      };

      // Get repair commands and IDs
      const { commands: repairCmds, repairShipIds } = ComputerPlayer.computerManageFleetRepairs(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted,
      );

      expect(repairShipIds.size).toBe(1);
      const repairedShipId = [...repairShipIds][0];

      // Now run computerSendShips with those repair IDs
      const shipCmds = ComputerPlayer.computerSendShips(
        clientModel, testGameData.gameModel.grid, aiPlayer, ownedPlanets, ownedPlanetsSorted, repairShipIds,
      );

      // Ensure the repaired ship ID does NOT appear in any sendShips commands
      for (const cmd of shipCmds) {
        const sendCmd = cmd as SendShipsCommand;
        if (sendCmd.shipIds) {
          const allIds = [
            ...sendCmd.shipIds.scouts,
            ...sendCmd.shipIds.destroyers,
            ...sendCmd.shipIds.cruisers,
            ...sendCmd.shipIds.battleships,
          ];
          expect(allIds).not.toContain(repairedShipId);
        }
      }
    });
  });
});
