import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as engine from "astriarch-engine";

import { buildStartingGameModel } from "./buildGameModel";
import { setTestGalaxySeed } from "./testGalaxySeed";
import { logger } from "./logger";

const PLAYER_ID = "p1";

function players(): engine.PlayerData[] {
  return [
    engine.Player.constructPlayer(PLAYER_ID, engine.PlayerType.Human, "Host", engine.playerColors[0]),
    engine.Player.constructPlayer("p2", engine.PlayerType.Computer_Normal, "Computer 1", engine.playerColors[1]),
  ];
}

const options = {
  systemsToGenerate: 2,
  planetsPerSystem: 6,
  galaxySize: engine.GalaxySizeOption.MEDIUM,
  distributePlanetsEvenly: true,
  quickStart: false,
  gameSpeed: engine.GameSpeed.NORMAL,
};

function outgoingIds(planet: engine.PlanetData): number[] {
  return planet.outgoingFleets.map((f) => f.id).sort((a, b) => a - b);
}

describe("fleet ids stay in sync between client and server", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    setTestGalaxySeed(20261123);
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    setTestGalaxySeed(null);
    vi.restoreAllMocks();
  });

  it("assigns the same send and waypoint fleet ids whatever the build/send order, and survives a save/load", () => {
    const gameModel = buildStartingGameModel(players(), options);
    const serverModel = gameModel.modelData;
    const grid = gameModel.grid;
    const serverPlayer = serverModel.players.find((p) => p.id === PLAYER_ID)!;
    const home = serverModel.planets.find((p) => p.id === serverPlayer.homePlanetId)!;
    const dest = serverModel.planets.find((p) => p.id !== home.id)!;

    // Shared starting state
    const scout = engine.Fleet.generateStarship(engine.StarShipType.Scout, undefined, home);
    home.planetaryFleet.starships.push(scout);
    engine.Fleet.recalculateFleetCompositionHash(home.planetaryFleet);
    home.waypointBoundingHexMidPoint = dest.boundingHexMidPoint;
    home.buildQueue = [];
    home.resources.energy = 1000;
    home.resources.ore = 1000;
    home.resources.iridium = 1000;

    const client = engine.constructClientGameModel(structuredClone(serverModel), PLAYER_ID);
    const clientHome = client.mainPlayerOwnedPlanets[home.id]!;

    const queue: engine.QueueProductionItemCommand = {
      type: engine.GameCommandType.QUEUE_PRODUCTION_ITEM,
      playerId: PLAYER_ID,
      timestamp: 0,
      commandId: "queue-1",
      planetId: home.id,
      productionItem: engine.PlanetProductionItem.constructStarShipInProduction(engine.StarShipType.Scout),
    };
    expect(engine.CommandProcessor.processCommand(client, grid, structuredClone(queue)).success).toBe(true);
    expect(engine.CommandProcessor.processCommand(serverModel, grid, structuredClone(queue)).success).toBe(true);
    const builtShipId = home.buildQueue[0]!.starshipData!.assignedShipId!;
    expect(clientHome.buildQueue[0]!.starshipData!.assignedShipId).toBe(builtShipId);
    for (const p of [clientHome, home]) {
      p.buildQueue[0]!.productionCostComplete = p.buildQueue[0]!.baseProductionCost;
    }

    const fleetId = engine.Fleet.allocateFleetId(client.mainPlayer, client.mainPlayerOwnedPlanets);
    const send: engine.SendShipsCommand = {
      type: engine.GameCommandType.SEND_SHIPS,
      playerId: PLAYER_ID,
      timestamp: 0,
      commandId: "send-1",
      fromPlanetId: home.id,
      toPlanetId: dest.id,
      fleetId,
      shipIds: { scouts: [scout.id], destroyers: [], cruisers: [], battleships: [] },
    };

    // Client: send, then build
    expect(engine.CommandProcessor.processCommand(client, grid, structuredClone(send)).success).toBe(true);
    engine.Planet.buildImprovements(
      clientHome,
      client.mainPlayer,
      grid,
      engine.Planet.getPlanetWorkerResourceGeneration(clientHome, client.mainPlayer),
    );

    // Server: build, then send
    engine.Planet.buildImprovements(
      home,
      serverPlayer,
      grid,
      engine.Planet.getPlanetWorkerResourceGeneration(home, serverPlayer),
    );
    expect(engine.CommandProcessor.processCommand(serverModel, grid, structuredClone(send)).success).toBe(true);

    const waypointId = engine.Fleet.waypointFleetIdForStarship(home.id, builtShipId);
    expect(waypointId).toBeLessThan(0);
    expect(outgoingIds(home)).toEqual([waypointId, fleetId].sort((a, b) => a - b));
    expect(outgoingIds(clientHome)).toEqual(outgoingIds(home));
    expect(client.mainPlayer.nextFleetId).toBe(serverPlayer.nextFleetId);

    // Stand in for a Mongo save and load
    const reloaded = engine.GameModel.constructGridWithModelData(JSON.parse(JSON.stringify(serverModel)));
    const reloadedPlayer = reloaded.modelData.players.find((p) => p.id === PLAYER_ID)!;
    const reloadedHome = reloaded.modelData.planets.find((p) => p.id === home.id)!;
    expect(outgoingIds(reloadedHome)).toEqual(outgoingIds(home));
    expect(reloadedPlayer.nextFleetId).toBe(serverPlayer.nextFleetId);

    const freshClient = engine.constructClientGameModel(reloaded.modelData, PLAYER_ID);
    expect(outgoingIds(freshClient.mainPlayerOwnedPlanets[home.id]!)).toEqual(outgoingIds(clientHome));
    expect(freshClient.mainPlayer.nextFleetId).toBe(client.mainPlayer.nextFleetId);
    expect(engine.Fleet.allocateFleetId(freshClient.mainPlayer, freshClient.mainPlayerOwnedPlanets)).toBe(fleetId + 1);
  });
});
