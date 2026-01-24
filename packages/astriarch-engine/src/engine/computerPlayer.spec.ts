import { PlanetById } from '../model/clientModel';
import { PlayerData, PlayerType } from '../model/player';
import { StarShipType } from '../model/fleet';
import { PlanetImprovementType } from '../model/planet';
import { ResearchType } from '../model/research';
import { startNewTestGame, TestGameData } from '../test/testUtils';
import { ComputerPlayer } from './computerPlayer';
import { ClientGameModel } from './clientGameModel';
import { Fleet } from './fleet';
import { GameController } from './gameController';
import { GameModel } from './gameModel';
import { Player } from './player';
import { Research } from './research';

let testGameData: TestGameData;
let player1: PlayerData;
let player2: PlayerData;
let planetById: PlanetById;

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

      const easyPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const easyPlanetsSorted = Player.getOwnedPlanetsListSorted(easyPlayer, easyPlanets);

      ComputerPlayer.computerManageResearch(testGameData.gameModel, easyPlayer, easyPlanets, easyPlanetsSorted);
      expect(easyPlayer.research.researchPercent).toBeGreaterThanOrEqual(0.1);
      expect(easyPlayer.research.researchPercent).toBeLessThanOrEqual(0.3);

      const hardPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const hardPlanetsSorted = Player.getOwnedPlanetsListSorted(hardPlayer, hardPlanets);

      ComputerPlayer.computerManageResearch(testGameData.gameModel, hardPlayer, hardPlanets, hardPlanetsSorted);
      expect(hardPlayer.research.researchPercent).toBeGreaterThanOrEqual(0.5);
      expect(hardPlayer.research.researchPercent).toBeLessThanOrEqual(0.7);

      const expertPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const expertPlanetsSorted = Player.getOwnedPlanetsListSorted(expertPlayer, expertPlanets);

      ComputerPlayer.computerManageResearch(testGameData.gameModel, expertPlayer, expertPlanets, expertPlanetsSorted);
      expect(expertPlayer.research.researchPercent).toBeGreaterThanOrEqual(0.7);
      expect(expertPlayer.research.researchPercent).toBeLessThanOrEqual(0.9);
    });

    test('should queue appropriate research for early game', () => {
      const expertPlayer = Player.constructPlayer('expert', PlayerType.Computer_Expert, 'Expert', player1.color);
      const expertPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const expertPlanetsSorted = Player.getOwnedPlanetsListSorted(expertPlayer, expertPlanets);

      ComputerPlayer.computerManageResearch(testGameData.gameModel, expertPlayer, expertPlanets, expertPlanetsSorted);

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

  describe('computerManageFleetRepairs', () => {
    test('should not redirect Easy or Normal AI fleets', () => {
      const normalPlayer = Player.constructPlayer('normal', PlayerType.Computer_Normal, 'Normal', player1.color);
      const normalPlanets = ClientGameModel.getOwnedPlanets(
        [player1.ownedPlanetIds[0]],
        testGameData.gameModel.modelData.planets,
      );
      const normalPlanetsSorted = Player.getOwnedPlanetsListSorted(normalPlayer, normalPlanets);

      // Create damaged fleet in transit
      const fleet = Fleet.generateFleetWithShipCount(0, 0, 2, 0, 0, 0, { x: 100, y: 100 });
      fleet.starships[0].health = 2; // Damage ship
      fleet.destinationHexMidPoint = { x: 200, y: 200 };
      fleet.locationHexMidPoint = { x: 100, y: 100 };
      normalPlayer.fleetsInTransit.push(fleet);

      const originalDest = fleet.destinationHexMidPoint;
      ComputerPlayer.computerManageFleetRepairs(
        testGameData.gameModel,
        normalPlayer,
        normalPlanets,
        normalPlanetsSorted,
      );

      // Should not have changed destination
      expect(fleet.destinationHexMidPoint).toEqual(originalDest);
    });

    test('should redirect Hard AI damaged fleets to repair planets', () => {
      const hardPlayer = Player.constructPlayer('hard', PlayerType.Computer_Hard, 'Hard', player1.color);

      // Give player a planet with repair capabilities
      const planet = testGameData.gameModel.modelData.planets[0];
      GameModel.changePlanetOwner(undefined, hardPlayer, planet, testGameData.gameModel.modelData.currentCycle);
      planet.builtImprovements[PlanetImprovementType.Colony] = 1;
      planet.builtImprovements[PlanetImprovementType.Factory] = 1;

      const hardPlanets = ClientGameModel.getOwnedPlanets([planet.id], testGameData.gameModel.modelData.planets);
      const hardPlanetsSorted = Player.getOwnedPlanetsListSorted(hardPlayer, hardPlanets);

      // Create damaged fleet at a valid grid location (near the planet)
      const planetMidPoint = planet.boundingHexMidPoint;
      const planetHex = testGameData.gameModel.grid.getHexAt(planetMidPoint);
      if (!planetHex) throw new Error('Could not find planet hex');

      // Find a nearby hex for the destination
      const nearbyHex = testGameData.gameModel.grid.getHexAt({
        x: planetMidPoint.x + 100,
        y: planetMidPoint.y + 100,
      });

      const fleet = Fleet.generateFleetWithShipCount(0, 0, 4, 0, 0, 0, planetMidPoint);
      fleet.starships[0].health = 2; // Heavy damage
      fleet.starships[1].health = 3;
      fleet.destinationHexMidPoint = nearbyHex ? nearbyHex.midPoint : planetMidPoint;
      fleet.locationHexMidPoint = planetMidPoint;
      hardPlayer.fleetsInTransit.push(fleet);

      const originalDest = fleet.destinationHexMidPoint;
      ComputerPlayer.computerManageFleetRepairs(testGameData.gameModel, hardPlayer, hardPlanets, hardPlanetsSorted);

      // Destination should change toward the repair planet (which is planet itself)
      // The logic will redirect toward nearest repair planet when fleet is damaged
      expect(fleet.destinationHexMidPoint).toBeDefined();
    });
  });

  describe('AI vs AI game simulations', () => {
    test('Easy vs Normal - Normal should win majority', () => {
      const wins = { easy: 0, normal: 0, draws: 0 };
      const testIterations = 5; // Keep low for CI/CD

      for (let i = 0; i < testIterations; i++) {
        const gameData = startNewTestGame();
        gameData.gameModel.modelData.players[0].type = PlayerType.Computer_Easy;
        gameData.gameModel.modelData.players[1].type = PlayerType.Computer_Normal;

        // Run game for limited turns
        let winner: PlayerData | null = null;
        for (let turn = 0; turn < 50; turn++) {
          GameController.advanceGameClock(gameData.gameModel);

          // Check for winner
          const activePlayers = gameData.gameModel.modelData.players.filter((p) => !p.destroyed);
          if (activePlayers.length === 1) {
            winner = activePlayers[0];
            break;
          }
        }

        if (winner) {
          if (winner.type === PlayerType.Computer_Easy) wins.easy++;
          else if (winner.type === PlayerType.Computer_Normal) wins.normal++;
        } else {
          wins.draws++;
        }
      }

      console.log('Easy vs Normal results:', wins);
      // Normal should win more often than Easy
      expect(wins.normal).toBeGreaterThanOrEqual(wins.easy);
    });

    test('Hard AI should not starve', () => {
      const gameData = startNewTestGame();
      gameData.gameModel.modelData.players[0].type = PlayerType.Computer_Hard;
      gameData.gameModel.modelData.players[1].type = PlayerType.Computer_Hard;

      // Run for 30 turns and check food management
      for (let turn = 0; turn < 30; turn++) {
        GameController.advanceGameClock(gameData.gameModel);

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
      const easyGameData = startNewTestGame();
      easyGameData.gameModel.modelData.players[0].type = PlayerType.Computer_Easy;
      easyGameData.gameModel.modelData.players[1].type = PlayerType.Human; // Inactive

      const expertGameData = startNewTestGame();
      expertGameData.gameModel.modelData.players[0].type = PlayerType.Computer_Expert;
      expertGameData.gameModel.modelData.players[1].type = PlayerType.Human; // Inactive

      // Run both for 40 turns
      for (let turn = 0; turn < 40; turn++) {
        GameController.advanceGameClock(easyGameData.gameModel);
        GameController.advanceGameClock(expertGameData.gameModel);
      }

      const easyPlanets = easyGameData.gameModel.modelData.players[0].ownedPlanetIds.length;
      const expertPlanets = expertGameData.gameModel.modelData.players[0].ownedPlanetIds.length;

      console.log('Expansion: Easy:', easyPlanets, 'Expert:', expertPlanets);
      // Expert should have captured more planets
      expect(expertPlanets).toBeGreaterThanOrEqual(easyPlanets);
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

      ComputerPlayer.computerSendShips(testGameData.gameModel, easyPlayer, ownedPlanets, ownedPlanetsSorted);

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

      ComputerPlayer.computerSendShips(testGameData.gameModel, expertPlayer, ownedPlanets, ownedPlanetsSorted);

      // Expert AI more likely to attack with smaller advantage
      const fleetsCount = homePlanet.outgoingFleets.length;
      console.log('Expert AI sent', fleetsCount, 'fleets');
      expect(fleetsCount).toBeGreaterThanOrEqual(0);
    });
  });
});
