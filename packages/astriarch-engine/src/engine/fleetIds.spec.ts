import { describe, it, expect, beforeEach } from 'vitest';
import { PlanetaryConflictData } from '../model/battle';
import { ClientModelData } from '../model/clientModel';
import { StarShipType } from '../model/fleet';
import { ModelData } from '../model/model';
import { PlanetData, PlanetImprovementType } from '../model/planet';
import { PlayerData, PlayerType } from '../model/player';
import { startNewTestGame, TestGameData } from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { CommandProcessor } from './CommandProcessor';
import { ComputerPlayer } from './computerPlayer';
import { EventApplicator } from './EventApplicator';
import { Fleet } from './fleet';
import {
  ClientEventType,
  CommandResultErrorCode,
  FleetDefenseSuccessEvent,
  FleetLaunchedEvent,
  GameCommandType,
  PlanetCapturedEvent,
  PlanetLostEvent,
  QueueProductionItemCommand,
  SendShipsCommand,
} from './GameCommands';
import { Grid } from './grid';
import { Planet } from './planet';
import { PlanetProductionItem } from './planetProductionItem';
import { Player } from './player';

const RANGE = 2 ** 21;
const PLAYER_ID = 'me';

let testGameData: TestGameData;
let serverModel: ModelData;
let grid: Grid;
let serverPlayer: PlayerData;
let homePlanet: PlanetData;
let destPlanet: PlanetData;

function makeClient(): ClientModelData {
  return ClientGameModel.constructClientGameModel(structuredClone(serverModel), PLAYER_ID);
}

function serverView(): ClientModelData {
  // Shares object references with the server model
  return ClientGameModel.constructClientGameModel(serverModel, PLAYER_ID);
}

function sendCommand(fleetId: number, shipIds: string[], fromPlanetId = homePlanet.id): SendShipsCommand {
  return {
    type: GameCommandType.SEND_SHIPS,
    playerId: PLAYER_ID,
    timestamp: 0,
    commandId: `send-${fleetId}-${shipIds.join(',')}`,
    fromPlanetId,
    toPlanetId: destPlanet.id,
    fleetId,
    shipIds: { scouts: shipIds, destroyers: [], cruisers: [], battleships: [] },
  };
}

function addScouts(planet: PlanetData, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const ship = Fleet.generateStarship(StarShipType.Scout, undefined, planet);
    planet.planetaryFleet.starships.push(ship);
    ids.push(ship.id);
  }
  Fleet.recalculateFleetCompositionHash(planet.planetaryFleet);
  return ids;
}

describe('Fleet ids', () => {
  beforeEach(() => {
    testGameData = startNewTestGame();
    serverModel = testGameData.gameModel.modelData;
    grid = testGameData.gameModel.grid;
    serverPlayer = serverModel.players.find((p) => p.id === PLAYER_ID)!;
    homePlanet = serverModel.planets.find((p) => p.id === serverPlayer.homePlanetId)!;
    destPlanet = serverModel.planets.find((p) => p.id !== homePlanet.id)!;
  });

  describe('generateFleet()', () => {
    it('increments the counter by exactly one when no id is supplied', () => {
      serverPlayer.nextFleetId = 3;
      const fleet = Fleet.generateFleet([], null, serverPlayer);
      expect(fleet.id).toBe(3);
      expect(serverPlayer.nextFleetId).toBe(4);
    });

    it('moves the counter past a larger supplied id', () => {
      serverPlayer.nextFleetId = 3;
      const fleet = Fleet.generateFleet([], null, serverPlayer, 10);
      expect(fleet.id).toBe(10);
      expect(serverPlayer.nextFleetId).toBe(11);
    });

    it('leaves the counter alone for a smaller supplied id', () => {
      serverPlayer.nextFleetId = 5;
      const fleet = Fleet.generateFleet([], null, serverPlayer, 2);
      expect(fleet.id).toBe(2);
      expect(serverPlayer.nextFleetId).toBe(5);
    });

    it('does not change the counter for an id below zero', () => {
      serverPlayer.nextFleetId = 5;
      const fleet = Fleet.generateFleet([], null, serverPlayer, -42);
      expect(fleet.id).toBe(-42);
      expect(serverPlayer.nextFleetId).toBe(5);
    });
  });

  describe('launchFleetToPlanet() with a supplied fleetId', () => {
    function launch(fleetId: number) {
      const [shipId] = addScouts(homePlanet, 1);
      return Fleet.launchFleetToPlanet(
        homePlanet,
        destPlanet,
        grid,
        { scouts: [shipId], destroyers: [], cruisers: [], battleships: [] },
        serverPlayer,
        fleetId,
      );
    }

    it('moves the counter to fleetId + 1 when the id is above the counter', () => {
      // A supplied id above the counter catches an extra increment: it would leave the counter at 4
      serverPlayer.nextFleetId = 3;
      const fleet = launch(7);
      expect(fleet.id).toBe(7);
      expect(serverPlayer.nextFleetId).toBe(8);
    });

    it('leaves the counter unchanged when the id is below the counter', () => {
      serverPlayer.nextFleetId = 9;
      const fleet = launch(4);
      expect(fleet.id).toBe(4);
      expect(serverPlayer.nextFleetId).toBe(9);
    });
  });

  it('cloneFleet() changes neither the counter nor the id', () => {
    serverPlayer.nextFleetId = 9;
    const original = Fleet.generateFleet([], null, undefined, 4);
    const clone = Fleet.cloneFleet(original);
    expect(clone.id).toBe(4);
    expect(serverPlayer.nextFleetId).toBe(9);
  });

  describe('allocateFleetId()', () => {
    it('skips ids already used in transit or outgoing, without incrementing', () => {
      serverPlayer.nextFleetId = 3;
      serverPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 3));
      homePlanet.outgoingFleets.push(Fleet.generateFleet([], null, undefined, 4));
      const owned = ClientGameModel.getOwnedPlanets(serverPlayer.ownedPlanetIds, serverModel.planets);
      expect(Fleet.allocateFleetId(serverPlayer, owned)).toBe(5);
      expect(Fleet.allocateFleetId(serverPlayer, Object.values(owned))).toBe(5);
      expect(serverPlayer.nextFleetId).toBe(3);
    });

    it('skips an old-save fleet id that is above the counter', () => {
      serverPlayer.nextFleetId = 2;
      serverPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 2));
      serverPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 3));
      serverPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 10));
      expect(Fleet.allocateFleetId(serverPlayer, [])).toBe(4);
    });

    it('returns 1 when nextFleetId is missing', () => {
      (serverPlayer as { nextFleetId?: number }).nextFleetId = undefined;
      expect(Fleet.allocateFleetId(serverPlayer, [])).toBe(1);
      Fleet.reserveFleetId(serverPlayer, 1);
      expect(serverPlayer.nextFleetId).toBe(2);
    });
  });

  describe('waypointFleetIdForStarship()', () => {
    it('encodes a well-formed starship id', () => {
      expect(Fleet.waypointFleetIdForStarship(7, '7_3')).toBe(-(7 * RANGE + 3));
    });

    it('is deterministic and always below zero', () => {
      for (const shipId of ['1_0', '7_3', '123_456', 'fallback_5', 'abc', '']) {
        const a = Fleet.waypointFleetIdForStarship(7, shipId);
        expect(a).toBe(Fleet.waypointFleetIdForStarship(7, shipId));
        expect(a).toBeLessThan(0);
        expect(Number.isSafeInteger(a)).toBe(true);
      }
    });

    it('maps legacy or out-of-range ids into the fallback range', () => {
      for (const shipId of ['fallback_5', '7_3000000', '0_5']) {
        const id = Fleet.waypointFleetIdForStarship(7, shipId);
        expect(id).toBeLessThan(0);
        expect(-id).toBeGreaterThanOrEqual(1);
        expect(-id).toBeLessThan(RANGE);
      }
    });

    it('gives distinct fleet ids for distinct well-formed ship ids', () => {
      const ids = new Set<number>();
      for (let planetId = 1; planetId <= 20; planetId++) {
        for (let seq = 0; seq < 50; seq++) {
          ids.add(Fleet.waypointFleetIdForStarship(planetId, `${planetId}_${seq}`));
        }
      }
      expect(ids.size).toBe(20 * 50);
    });
  });

  describe('client/server parity', () => {
    it('gives the same ids regardless of build-vs-send order', () => {
      // Shared starting state: scouts on the home planet, a waypoint, plenty of resources
      const [sendShipId] = addScouts(homePlanet, 2);
      homePlanet.waypointBoundingHexMidPoint = destPlanet.boundingHexMidPoint;
      homePlanet.buildQueue = [];
      homePlanet.resources.energy = 1000;
      homePlanet.resources.ore = 1000;
      homePlanet.resources.iridium = 1000;
      homePlanet.resources.food = 1000;

      const client = makeClient();
      const clientPlanet = client.mainPlayerOwnedPlanets[homePlanet.id];

      // Queue a scout on the client, then on the server
      const queueCommand: QueueProductionItemCommand = {
        type: GameCommandType.QUEUE_PRODUCTION_ITEM,
        playerId: PLAYER_ID,
        timestamp: 0,
        commandId: 'queue-1',
        planetId: homePlanet.id,
        productionItem: PlanetProductionItem.constructStarShipInProduction(StarShipType.Scout),
      };
      const clientQueue = CommandProcessor.processCommand(client, grid, structuredClone(queueCommand));
      const serverQueue = CommandProcessor.processCommand(serverModel, grid, structuredClone(queueCommand));
      expect(clientQueue.success).toBe(true);
      expect(serverQueue.success).toBe(true);

      const clientAssigned = clientPlanet.buildQueue[0].starshipData!.assignedShipId!;
      const serverAssigned = homePlanet.buildQueue[0].starshipData!.assignedShipId!;
      expect(clientAssigned).toBeDefined();
      expect(clientAssigned).toBe(serverAssigned);

      for (const p of [clientPlanet, homePlanet]) {
        p.buildQueue[0].productionCostComplete = p.buildQueue[0].baseProductionCost;
      }

      const fleetId = Fleet.allocateFleetId(client.mainPlayer, client.mainPlayerOwnedPlanets);
      const command = sendCommand(fleetId, [sendShipId]);

      // Client: send, then build
      const clientSend = CommandProcessor.processCommand(client, grid, structuredClone(command));
      expect(clientSend.success).toBe(true);
      Planet.buildImprovements(
        clientPlanet,
        client.mainPlayer,
        grid,
        Planet.getPlanetWorkerResourceGeneration(clientPlanet, client.mainPlayer),
      );

      // Server: build, then send
      Planet.buildImprovements(
        homePlanet,
        serverPlayer,
        grid,
        Planet.getPlanetWorkerResourceGeneration(homePlanet, serverPlayer),
      );
      const serverSend = CommandProcessor.processCommand(serverModel, grid, structuredClone(command));
      expect(serverSend.success).toBe(true);

      const expectedWaypointId = Fleet.waypointFleetIdForStarship(homePlanet.id, serverAssigned);
      for (const planet of [clientPlanet, homePlanet]) {
        const sent = planet.outgoingFleets.find((f) => f.starships.some((s) => s.id === sendShipId));
        const waypoint = planet.outgoingFleets.find((f) => f.starships.some((s) => s.id === serverAssigned));
        expect(sent?.id).toBe(fleetId);
        expect(waypoint?.id).toBe(expectedWaypointId);
        expect(waypoint!.id).toBeLessThan(0);
        expect(waypoint!.id).not.toBe(sent!.id);
      }
      expect(client.mainPlayer.nextFleetId).toBe(serverPlayer.nextFleetId);
      expect(client.mainPlayer.nextFleetId).toBe(fleetId + 1);

      const server = serverView();
      for (const model of [client, server]) {
        Player.moveShips({ clientModel: model, cyclesElapsed: 0.001, currentCycle: model.currentCycle, grid });
        const ids = model.mainPlayer.fleetsInTransit.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
      const sortedIds = (m: ClientModelData) => m.mainPlayer.fleetsInTransit.map((f) => f.id).sort((a, b) => a - b);
      expect(sortedIds(client)).toEqual(sortedIds(server));
    });

    it('keeps both counters at lastId + 1 across several sends', () => {
      const shipIds = addScouts(homePlanet, 3);
      const client = makeClient();
      for (const shipId of shipIds) {
        const fleetId = Fleet.allocateFleetId(client.mainPlayer, client.mainPlayerOwnedPlanets);
        const command = sendCommand(fleetId, [shipId]);
        expect(CommandProcessor.processCommand(client, grid, structuredClone(command)).success).toBe(true);
        expect(CommandProcessor.processCommand(serverModel, grid, structuredClone(command)).success).toBe(true);
        expect(client.mainPlayer.nextFleetId).toBe(fleetId + 1);
        expect(serverPlayer.nextFleetId).toBe(fleetId + 1);
      }
    });

    it('EventApplicator FLEET_LAUNCHED leaves the counter at fleetId + 1', () => {
      const [shipId] = addScouts(homePlanet, 1);
      const client = makeClient();
      client.mainPlayer.nextFleetId = 4;
      const event: FleetLaunchedEvent = {
        type: ClientEventType.FLEET_LAUNCHED,
        affectedPlayerIds: [PLAYER_ID],
        data: {
          fleetId: 6,
          fromPlanetId: homePlanet.id,
          toPlanetId: destPlanet.id,
          shipIds: { scouts: [shipId], destroyers: [], cruisers: [], battleships: [] },
        },
      };
      EventApplicator.applyEvent(client, event, grid);
      const launched = client.mainPlayerOwnedPlanets[homePlanet.id].outgoingFleets.find((f) => f.id === 6);
      expect(launched).toBeDefined();
      expect(client.mainPlayer.nextFleetId).toBe(7);
    });
  });

  describe('processSendShips() fleet id validation', () => {
    it.each([0, -5, 1.5, Number.MAX_SAFE_INTEGER])('rejects invalid fleet id %s', (badId) => {
      const [shipId] = addScouts(homePlanet, 1);
      const result = CommandProcessor.processCommand(serverModel, grid, sendCommand(badId, [shipId]));
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CommandResultErrorCode.INVALID_PARAMETER);
      expect(result.error?.possibleDesync).toBe(false);
      expect(homePlanet.planetaryFleet.starships.some((s) => s.id === shipId)).toBe(true);
    });

    it('accepts an id exactly MAX_FLEET_ID_JUMP above the counter', () => {
      const [shipId] = addScouts(homePlanet, 1);
      serverPlayer.nextFleetId = 3;
      const fleetId = 3 + Fleet.MAX_FLEET_ID_JUMP;
      const result = CommandProcessor.processCommand(serverModel, grid, sendCommand(fleetId, [shipId]));
      expect(result.success).toBe(true);
      expect(serverPlayer.nextFleetId).toBe(4 + Fleet.MAX_FLEET_ID_JUMP);
    });

    it.each([4 + Fleet.MAX_FLEET_ID_JUMP, Number.MAX_SAFE_INTEGER - 1])(
      'rejects id %s, more than MAX_FLEET_ID_JUMP above the counter, without moving it',
      (farId) => {
        const [shipId] = addScouts(homePlanet, 1);
        serverPlayer.nextFleetId = 3;
        const result = CommandProcessor.processCommand(serverModel, grid, sendCommand(farId, [shipId]));
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(CommandResultErrorCode.INVALID_PARAMETER);
        expect(result.error?.possibleDesync).toBe(false);
        expect(serverPlayer.nextFleetId).toBe(3);
        expect(homePlanet.planetaryFleet.starships.some((s) => s.id === shipId)).toBe(true);
      },
    );

    it('measures the jump from 1 when nextFleetId is missing', () => {
      const [shipId] = addScouts(homePlanet, 1);
      (serverPlayer as { nextFleetId?: number }).nextFleetId = undefined;
      const tooFar = CommandProcessor.processCommand(
        serverModel,
        grid,
        sendCommand(2 + Fleet.MAX_FLEET_ID_JUMP, [shipId]),
      );
      expect(tooFar.success).toBe(false);
      expect(tooFar.error?.possibleDesync).toBe(false);
      const result = CommandProcessor.processCommand(serverModel, grid, sendCommand(2, [shipId]));
      expect(result.success).toBe(true);
    });

    it('rejects an id already in transit as a possible desync and bumps the counter', () => {
      const [shipId] = addScouts(homePlanet, 1);
      serverPlayer.nextFleetId = 2;
      serverPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 5));
      const result = CommandProcessor.processCommand(serverModel, grid, sendCommand(5, [shipId]));
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CommandResultErrorCode.INVALID_PARAMETER);
      expect(result.error?.possibleDesync).toBe(true);
      expect(serverPlayer.nextFleetId).toBeGreaterThan(5);
      expect(homePlanet.planetaryFleet.starships.some((s) => s.id === shipId)).toBe(true);
    });

    it('rejects an id already used by an outgoing fleet on the server as a possible desync', () => {
      const [shipId] = addScouts(homePlanet, 1);
      serverPlayer.nextFleetId = 2;
      homePlanet.outgoingFleets.push(Fleet.generateFleet([], null, undefined, 6));
      const result = CommandProcessor.processCommand(serverModel, grid, sendCommand(6, [shipId]));
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CommandResultErrorCode.INVALID_PARAMETER);
      expect(result.error?.possibleDesync).toBe(true);
      expect(serverPlayer.nextFleetId).toBe(7);
      expect(homePlanet.planetaryFleet.starships.some((s) => s.id === shipId)).toBe(true);
    });

    it('rejects a waypoint-range (negative) id at the sign check, not as a desync', () => {
      const [shipId] = addScouts(homePlanet, 1);
      serverPlayer.nextFleetId = 2;
      const waypointId = Fleet.waypointFleetIdForStarship(homePlanet.id, `${homePlanet.id}_999`);
      serverPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, waypointId));
      const result = CommandProcessor.processCommand(serverModel, grid, sendCommand(waypointId, [shipId]));
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CommandResultErrorCode.INVALID_PARAMETER);
      expect(result.error?.possibleDesync).toBe(false);
      expect(serverPlayer.nextFleetId).toBe(2);
    });
  });

  describe('conflict events and player-scoped fleet ids', () => {
    function conflictData(): PlanetaryConflictData {
      return { winningFleet: Fleet.generateFleet([], null, undefined, 99) } as PlanetaryConflictData;
    }

    it("PLANET_LOST does not remove the defender's own fleet with the attacker's id", () => {
      const client = makeClient();
      client.mainPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 3));
      const event: PlanetLostEvent = {
        type: ClientEventType.PLANET_LOST,
        affectedPlayerIds: [PLAYER_ID],
        data: {
          planetId: homePlanet.id,
          planetName: homePlanet.name,
          planetType: homePlanet.type,
          newOwnerId: 'c1',
          newOwnerName: 'Attacker',
          conflictData: conflictData(),
          attackingFleetId: 3,
        },
      };
      EventApplicator.applyEvent(client, event, grid);
      expect(client.mainPlayer.fleetsInTransit.some((f) => f.id === 3)).toBe(true);
      expect(client.mainPlayerOwnedPlanets[homePlanet.id]).toBeUndefined();
    });

    it("FLEET_DEFENSE_SUCCESS does not remove the defender's own fleet with the attacker's id", () => {
      const client = makeClient();
      client.mainPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 3));
      const event: FleetDefenseSuccessEvent = {
        type: ClientEventType.FLEET_DEFENSE_SUCCESS,
        affectedPlayerIds: [PLAYER_ID],
        data: {
          planetId: homePlanet.id,
          planetName: homePlanet.name,
          attackerName: 'Attacker',
          attackerId: 'c1',
          conflictData: conflictData(),
          attackingFleetId: 3,
        },
      };
      EventApplicator.applyEvent(client, event, grid);
      expect(client.mainPlayer.fleetsInTransit.some((f) => f.id === 3)).toBe(true);
    });

    it("PLANET_CAPTURED still removes the attacker's own fleet", () => {
      const client = makeClient();
      client.mainPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 5));
      const event: PlanetCapturedEvent = {
        type: ClientEventType.PLANET_CAPTURED,
        affectedPlayerIds: [PLAYER_ID],
        data: {
          planetId: destPlanet.id,
          planetName: destPlanet.name,
          conflictData: conflictData(),
          planetData: structuredClone(destPlanet),
          attackingFleetId: 5,
        },
      };
      EventApplicator.applyEvent(client, event, grid);
      expect(client.mainPlayer.fleetsInTransit.some((f) => f.id === 5)).toBe(false);
      expect(client.mainPlayerOwnedPlanets[destPlanet.id]).toBeDefined();
    });
  });

  describe('AI sends', () => {
    it('gives distinct, positive, accepted fleet ids to several sends planned in one pass', () => {
      const [planet1, planet2, planet3] = serverModel.planets.filter((p) => p.id !== homePlanet.id);
      const aiPlayer = Player.constructPlayer('ai', PlayerType.Computer_Hard, 'AI', serverPlayer.color);
      aiPlayer.ownedPlanetIds = [planet1.id, planet2.id, planet3.id];
      aiPlayer.homePlanetId = planet1.id;
      const noImprovements = {
        [PlanetImprovementType.Colony]: 0,
        [PlanetImprovementType.Factory]: 0,
        [PlanetImprovementType.Farm]: 0,
        [PlanetImprovementType.Mine]: 0,
      };
      for (const planet of [planet1, planet2]) {
        planet.builtImprovements = { ...noImprovements };
        planet.planetaryFleet = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, planet.boundingHexMidPoint);
        planet.planetaryFleet.starships[0].health = 1;
        planet.outgoingFleets = [];
      }
      planet3.builtImprovements = {
        ...noImprovements,
        [PlanetImprovementType.Colony]: 1,
        [PlanetImprovementType.Factory]: 1,
      };
      planet3.planetaryFleet = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, planet3.boundingHexMidPoint);
      planet3.outgoingFleets = [];
      serverModel.players.push(aiPlayer);

      const ownedPlanets = ClientGameModel.getOwnedPlanets(aiPlayer.ownedPlanetIds, serverModel.planets);
      const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(aiPlayer, ownedPlanets);
      const clientModel = ClientGameModel.constructClientGameModel(serverModel, aiPlayer.id);

      const { commands } = ComputerPlayer.computerManageFleetRepairs(
        clientModel,
        grid,
        aiPlayer,
        ownedPlanets,
        ownedPlanetsSorted,
      );
      expect(commands.length).toBeGreaterThanOrEqual(2);

      const fleetIds = (commands as SendShipsCommand[]).map((c) => c.fleetId);
      expect(new Set(fleetIds).size).toBe(fleetIds.length);
      for (const id of fleetIds) {
        expect(id).toBeGreaterThan(0);
      }
      for (const command of commands) {
        expect(CommandProcessor.processCommand(clientModel, grid, command).success).toBe(true);
      }
    });
  });
});
