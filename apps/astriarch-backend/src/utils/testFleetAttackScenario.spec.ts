import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as engine from "astriarch-engine";

import { buildStartingGameModel } from "./buildGameModel";
import { setTestGalaxySeed } from "./testGalaxySeed";
import { logger } from "./logger";
import { setupFleetAttack, SEEDED_PROTEST_LEVEL, COLLISION_PLANET_FOOD } from "./testFleetAttackScenario";

function players(): engine.PlayerData[] {
  return [
    engine.Player.constructPlayer("p1", engine.PlayerType.Human, "Host", engine.playerColors[0]),
    engine.Player.constructPlayer("p2", engine.PlayerType.Computer_Easy, "Computer 1", engine.playerColors[1]),
  ];
}

// Same game as e2e scenario G (apps/astriarch-frontend/e2e/scenarios/scenario-g-capture-large-fleet.spec.ts).
const SEED = 20261125;
/** Hex distance from S to T for SEED. */
const PINNED_HEX_DISTANCE = 1;
const options = {
  systemsToGenerate: 2,
  planetsPerSystem: 4,
  galaxySize: engine.GalaxySizeOption.SMALL,
  distributePlanetsEvenly: true,
  quickStart: true,
  gameSpeed: engine.GameSpeed.FASTEST,
};

const isMobile = (s: engine.StarshipData) =>
  s.type !== engine.StarShipType.SystemDefense && s.type !== engine.StarShipType.SpacePlatform;

describe("setupFleetAttack", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    setTestGalaxySeed(SEED);
    vi.spyOn(logger, "info").mockImplementation(() => logger);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    setTestGalaxySeed(null);
    vi.restoreAllMocks();
  });

  // Pinned layout: if galaxy generation drifts, this fails here instead of as an e2e flake.
  it("uses the pinned layout for the scenario G seed", () => {
    const { modelData } = buildStartingGameModel(players(), options);
    const result = setupFleetAttack(modelData);

    const H = result.homePlanetId;
    const T = result.targetPlanetId;
    expect(T).toBe(H + 4);
    expect(result.stagingPlanetId).toBe(T + 2);
    expect(result.aiSparePlanetId).toBe(T + 1);
    expect(result.collisionPlanetId).toBe(T - 2);
    expect(result.hexDistance).toBe(PINNED_HEX_DISTANCE);
  });

  it("puts a 47-ship, four-type fleet of strength >= 700 on the staging planet", () => {
    const { modelData } = buildStartingGameModel(players(), options);
    const result = setupFleetAttack(modelData);
    const staging = modelData.planets.find((p) => p.id === result.stagingPlanetId)!;

    const mobile = staging.planetaryFleet.starships.filter(isMobile);
    expect(mobile).toHaveLength(47);
    expect(result.shipIds).toHaveLength(47);
    expect(mobile.map((s) => s.id).sort()).toEqual([...result.shipIds].sort());
    expect(new Set(mobile.map((s) => s.type))).toEqual(
      new Set([
        engine.StarShipType.Scout,
        engine.StarShipType.Destroyer,
        engine.StarShipType.Cruiser,
        engine.StarShipType.Battleship,
      ]),
    );
    expect(result.fleetStrength).toBe(744);
    expect(engine.Fleet.determineFleetStrength(staging.planetaryFleet, true)).toBeGreaterThanOrEqual(700);

    const allShipIds = modelData.planets.flatMap((p) => p.planetaryFleet.starships.map((s) => s.id));
    expect(new Set(allShipIds).size).toBe(allShipIds.length);

    expect(staging.planetaryFleet.compositionHash).toBe(
      engine.calculateFleetCompositionHash(staging.planetaryFleet.starships.map((s) => s.id)),
    );
  });

  it("assigns ownership and seeds protest on the collision planet", () => {
    const { modelData } = buildStartingGameModel(players(), options);
    const result = setupFleetAttack(modelData);
    const human = modelData.players.find((p) => p.id === result.playerId)!;
    const ai = modelData.players.find((p) => p.id === result.aiPlayerId)!;

    expect(ai.ownedPlanetIds).toEqual(expect.arrayContaining([result.targetPlanetId, result.aiSparePlanetId]));
    expect(human.ownedPlanetIds).toEqual(
      expect.arrayContaining([result.homePlanetId, result.stagingPlanetId, result.collisionPlanetId]),
    );

    const collision = modelData.planets.find((p) => p.id === result.collisionPlanetId)!;
    expect(collision.population.length).toBeGreaterThan(0);
    for (const citizen of collision.population) {
      expect(citizen.protestLevel).toBe(SEEDED_PROTEST_LEVEL);
    }
    expect(collision.resources.food).toBe(COLLISION_PLANET_FOOD);
  });

  it("honours custom counts", () => {
    const { modelData } = buildStartingGameModel(players(), options);
    const result = setupFleetAttack(modelData, { scouts: 1, destroyers: 0, cruisers: 0, battleships: 2 });
    expect(result.shipIds).toHaveLength(3);
    expect(result.fleetStrength).toBe(4 + 2 * 32);
  });

  it("throws, naming the planet, when a required planet is already owned", () => {
    const { modelData } = buildStartingGameModel(players(), options);
    const human = modelData.players.find((p) => p.type === engine.PlayerType.Human)!;
    const ai = modelData.players.find((p) => p.type !== engine.PlayerType.Human)!;
    const staging = ai.homePlanetId! + 2;
    human.ownedPlanetIds.push(staging);
    expect(() => setupFleetAttack(modelData)).toThrow(new RegExp(`staging planet ${staging} .*already owned`));
  });
});
