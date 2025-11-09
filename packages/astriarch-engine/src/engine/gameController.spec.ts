import { PlayerType, PlayerData } from '../model/player';
import { startNewTestGameWithOptions } from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { GameController } from './gameController';
import { Fleet } from './fleet';
import { Planet } from './planet';
import { GameModel, GameModelData } from './gameModel';
import { Events } from './events';
import { StarShipType } from '../model/fleet';
import { EventNotificationType, EventNotification, PlanetaryConflictData } from '../model/eventNotification';
import { PlanetType, PlanetData } from '../model/planet';
import { Utils } from '../utils/utils';
import { GridHex } from './grid';
import { HexagonData } from '../shapes/shapes';

const assertPointsBasedOnGameOptions = (
  expectedPoints: number,
  turnNumber: number,
  points: number,
  systemsToGenerate: number,
  planetsPerSystem: number,
  ownedPlanetCount: number,
  playerCount: number,
  playerWins: boolean,
  playerType: PlayerType = PlayerType.Computer_Expert,
) => {
  const testGameData = startNewTestGameWithOptions(
    turnNumber,
    points,
    systemsToGenerate,
    planetsPerSystem,
    ownedPlanetCount,
    playerCount,
    playerType,
  );
  const { modelData } = testGameData.gameModel;
  const [player] = modelData.players;
  const calculatedPoints = GameController.calculateEndGamePoints(modelData, player, playerWins);
  expect(calculatedPoints).toEqual(expectedPoints);
};

describe('GameController', () => {
  beforeEach(() => {});

  describe('CalculateEndGamePoints()', () => {
    it('should base points on total points at the end of the game', () => {
      assertPointsBasedOnGameOptions(438, 100, 100, 4, 4, 8, 4, true);
    });

    it('should award less points if the player loses', () => {
      assertPointsBasedOnGameOptions(404, 100, 100, 4, 4, 8, 4, false);
    });

    it('should handle awarding points even if the player owns no planets', () => {
      assertPointsBasedOnGameOptions(400, 100, 100, 4, 4, 0, 4, false);
    });

    it('should give bonus points for a quick game', () => {
      assertPointsBasedOnGameOptions(477, 50, 100, 4, 4, 8, 4, true);
    });

    it('should give less points for an easier game', () => {
      assertPointsBasedOnGameOptions(413, 100, 100, 2, 4, 8, 2, true, PlayerType.Human);
    });
  });

  describe('resolvePlanetaryConflicts()', () => {
    let gameModel: GameModelData;
    let attackingPlayer: PlayerData;
    let defendingPlayer: PlayerData;
    let targetPlanet: PlanetData;
    let capturedEvents: EventNotification[];

    beforeEach(() => {
      // Set up a basic game with two players
      const testGame = startNewTestGameWithOptions(10, 100, 2, 4, 1, 2, PlayerType.Human);
      gameModel = testGame.gameModel;
      [attackingPlayer, defendingPlayer] = gameModel.modelData.players;

      // Find a planet owned by the defending player
      targetPlanet = gameModel.modelData.planets.find((p: PlanetData) =>
        defendingPlayer.ownedPlanetIds.includes(p.id),
      )!;

      // Set up event capture
      capturedEvents = [];
      Events.subscribe(attackingPlayer.id, (_playerId: string, events: EventNotification[]) => {
        capturedEvents.push(...events);
      });
      Events.subscribe(defendingPlayer.id, (_playerId: string, events: EventNotification[]) => {
        capturedEvents.push(...events);
      });
    });

    it('should handle attacker winning and capturing planet', () => {
      // Set up a strong attacking fleet
      const attackingFleet = Fleet.generateFleetWithShipCount(0, 0, 0, 5, 0, 0, targetPlanet.boundingHexMidPoint);
      attackingFleet.destinationHexMidPoint = targetPlanet.boundingHexMidPoint;

      // Set up a weak defending fleet
      targetPlanet.planetaryFleet = Fleet.generateFleetWithShipCount(
        1,
        0,
        0,
        0,
        0,
        0,
        targetPlanet.boundingHexMidPoint,
      );

      // Store original owner info
      const originalOwnerId = defendingPlayer.id;
      const originalOwnerPlanetCount = defendingPlayer.ownedPlanetIds.length;

      // Execute the method
      GameController.resolvePlanetaryConflicts(gameModel, attackingPlayer, [attackingFleet]);

      // Verify planet ownership changed
      expect(defendingPlayer.ownedPlanetIds).not.toContain(targetPlanet.id);
      expect(attackingPlayer.ownedPlanetIds).toContain(targetPlanet.id);

      // Verify attacking fleet was merged to planet
      expect(targetPlanet.planetaryFleet.starships.length).toBeGreaterThan(0);

      // Verify last known fleet strength was recorded for old owner
      expect(defendingPlayer.lastKnownPlanetFleetStrength[targetPlanet.id]).toBeDefined();
      expect(defendingPlayer.lastKnownPlanetFleetStrength[targetPlanet.id].lastKnownOwnerId).toBe(attackingPlayer.id);

      // Verify events were generated
      Events.publish();
      const planetCapturedEvents = capturedEvents.filter((e) => e.type === EventNotificationType.PlanetCaptured);
      const planetLostEvents = capturedEvents.filter((e) => e.type === EventNotificationType.PlanetLost);

      expect(planetCapturedEvents.length).toBe(1);
      expect(planetLostEvents.length).toBe(1);
      expect(planetCapturedEvents[0].playerId).toBe(attackingPlayer.id);
      expect(planetLostEvents[0].playerId).toBe(defendingPlayer.id);
    });

    it('should handle attacker losing and defender keeping planet', () => {
      // Set up a weak attacking fleet
      const attackingFleet = Fleet.generateFleetWithShipCount(0, 1, 0, 0, 0, 0, targetPlanet.boundingHexMidPoint);
      attackingFleet.destinationHexMidPoint = targetPlanet.boundingHexMidPoint;

      // Set up a strong defending fleet
      targetPlanet.planetaryFleet = Fleet.generateFleetWithShipCount(
        5,
        0,
        0,
        0,
        0,
        0,
        targetPlanet.boundingHexMidPoint,
      );

      // Store original fleet strength for comparison
      const originalDefenderFleetSize = targetPlanet.planetaryFleet.starships.length;

      // Execute the method
      GameController.resolvePlanetaryConflicts(gameModel, attackingPlayer, [attackingFleet]);

      // Verify planet ownership remained the same
      expect(defendingPlayer.ownedPlanetIds).toContain(targetPlanet.id);
      expect(attackingPlayer.ownedPlanetIds).not.toContain(targetPlanet.id);

      // Verify planet was marked as explored by attacker
      expect(attackingPlayer.knownPlanetIds).toContain(targetPlanet.id);

      // Verify events were generated
      Events.publish();
      const attackingFleetLostEvents = capturedEvents.filter(
        (e) => e.type === EventNotificationType.AttackingFleetLost,
      );
      const defendedEvents = capturedEvents.filter(
        (e) => e.type === EventNotificationType.DefendedAgainstAttackingFleet,
      );

      expect(attackingFleetLostEvents.length).toBe(1);
      expect(defendedEvents.length).toBe(1);
      expect(attackingFleetLostEvents[0].playerId).toBe(attackingPlayer.id);
      expect(defendedEvents[0].playerId).toBe(defendingPlayer.id);
    });

    it('should handle attack on unowned planet', () => {
      // Find an unowned planet
      const unownedPlanet = gameModel.modelData.planets.find(
        (p: PlanetData) =>
          !gameModel.modelData.players.some((player: PlayerData) => player.ownedPlanetIds.includes(p.id)),
      );

      // Skip test if no unowned planet is available
      if (!unownedPlanet) {
        return;
      }

      // Store initial state
      const initialAttackerPlanetCount = attackingPlayer.ownedPlanetIds.length;

      // Set up attacking fleet
      const attackingFleet = Fleet.generateFleetWithShipCount(0, 2, 0, 0, 0, 0, unownedPlanet.boundingHexMidPoint);
      attackingFleet.destinationHexMidPoint = unownedPlanet.boundingHexMidPoint;

      // Execute the method
      GameController.resolvePlanetaryConflicts(gameModel, attackingPlayer, [attackingFleet]);

      // Verify planet was captured by attacker (planet count should increase)
      expect(attackingPlayer.ownedPlanetIds.length).toBe(initialAttackerPlanetCount + 1);
      expect(attackingPlayer.ownedPlanetIds).toContain(unownedPlanet.id);

      // Verify attacking fleet was merged to planet
      expect(unownedPlanet.planetaryFleet.starships.length).toBeGreaterThan(0);

      // Verify events were generated
      Events.publish();
      const planetCapturedEvents = capturedEvents.filter((e) => e.type === EventNotificationType.PlanetCaptured);
      expect(planetCapturedEvents.length).toBe(1);
    });

    it('should handle resource looting when planet is captured', () => {
      // Set up attacking fleet that will win
      const attackingFleet = Fleet.generateFleetWithShipCount(0, 0, 0, 10, 0, 0, targetPlanet.boundingHexMidPoint);
      attackingFleet.destinationHexMidPoint = targetPlanet.boundingHexMidPoint;

      // Set up planet with resources
      targetPlanet.resources = {
        food: 100,
        energy: 50,
        research: 25,
        ore: 75,
        iridium: 30,
        production: 60,
      };

      // Weak defending fleet
      targetPlanet.planetaryFleet = Fleet.generateFleetWithShipCount(
        1,
        0,
        0,
        0,
        0,
        0,
        targetPlanet.boundingHexMidPoint,
      );

      // Execute the method
      GameController.resolvePlanetaryConflicts(gameModel, attackingPlayer, [attackingFleet]);

      // Verify events contain resource looting info
      Events.publish();
      const planetCapturedEvents = capturedEvents.filter((e) => e.type === EventNotificationType.PlanetCaptured);
      expect(planetCapturedEvents.length).toBe(1);

      const eventData = planetCapturedEvents[0].data as PlanetaryConflictData;
      if (eventData) {
        expect(eventData.resourcesLooted).toBeDefined();
        expect(eventData.resourcesLooted.food).toBe(100);
        expect(eventData.resourcesLooted.energy).toBe(50);
      }
    });

    it('should record correct fleet strength in last known data after conquest', () => {
      // Set up attacking fleet with specific composition
      const attackingFleet = Fleet.generateFleetWithShipCount(0, 2, 1, 3, 0, 0, targetPlanet.boundingHexMidPoint);
      attackingFleet.destinationHexMidPoint = targetPlanet.boundingHexMidPoint;

      // Set up weak defending fleet that will be destroyed
      targetPlanet.planetaryFleet = Fleet.generateFleetWithShipCount(
        1,
        0,
        0,
        0,
        0,
        0,
        targetPlanet.boundingHexMidPoint,
      );

      // Execute the method
      GameController.resolvePlanetaryConflicts(gameModel, attackingPlayer, [attackingFleet]);

      // Check that the last known fleet strength shows the conquering fleet
      const lastKnownFleet = defendingPlayer.lastKnownPlanetFleetStrength[targetPlanet.id];
      expect(lastKnownFleet).toBeDefined();

      // The last known fleet should show ships from the attacking fleet (some may have been lost in battle)
      const fleetCounts = Fleet.countStarshipsByType(lastKnownFleet.fleetData);
      expect(fleetCounts.scouts + fleetCounts.destroyers + fleetCounts.cruisers).toBeGreaterThan(0);

      // Verify the owner is correctly recorded
      expect(lastKnownFleet.lastKnownOwnerId).toBe(attackingPlayer.id);
      expect(lastKnownFleet.cycleLastExplored).toBe(gameModel.modelData.currentCycle);
    });

    it('should handle multiple fleets attacking same planet', () => {
      // Set up multiple attacking fleets
      const attackingFleet1 = Fleet.generateFleetWithShipCount(0, 2, 0, 0, 0, 0, targetPlanet.boundingHexMidPoint);
      const attackingFleet2 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, targetPlanet.boundingHexMidPoint);

      attackingFleet1.destinationHexMidPoint = targetPlanet.boundingHexMidPoint;
      attackingFleet2.destinationHexMidPoint = targetPlanet.boundingHexMidPoint;

      // Set up defending fleet
      targetPlanet.planetaryFleet = Fleet.generateFleetWithShipCount(
        2,
        0,
        0,
        0,
        0,
        0,
        targetPlanet.boundingHexMidPoint,
      );

      // Execute the method with multiple fleets
      GameController.resolvePlanetaryConflicts(gameModel, attackingPlayer, [attackingFleet1, attackingFleet2]);

      // Verify both fleets were processed (planet should be captured or events generated)
      Events.publish();
      const totalEvents = capturedEvents.length;
      expect(totalEvents).toBeGreaterThan(0);

      // Should have handled both fleet conflicts
      const conflictEvents = capturedEvents.filter(
        (e) =>
          e.type === EventNotificationType.PlanetCaptured ||
          e.type === EventNotificationType.AttackingFleetLost ||
          e.type === EventNotificationType.DefendedAgainstAttackingFleet ||
          e.type === EventNotificationType.PlanetLost,
      );
      expect(conflictEvents.length).toBeGreaterThanOrEqual(2); // At least one event per fleet
    });
  });
});
