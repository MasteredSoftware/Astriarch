import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as engine from "astriarch-engine";

import { buildStartingGameModel } from "./buildGameModel";
import { setTestGalaxySeed } from "./testGalaxySeed";
import { logger } from "./logger";
import { grantNearestPlanetWithScout } from "./testScenarios";

function players(): engine.PlayerData[] {
  return [
    engine.Player.constructPlayer("p1", engine.PlayerType.Human, "Host", engine.playerColors[0]),
    engine.Player.constructPlayer("p2", engine.PlayerType.Computer_Easy, "Computer 1", engine.playerColors[1]),
  ];
}

const options = {
  systemsToGenerate: 2,
  planetsPerSystem: 4,
  galaxySize: engine.GalaxySizeOption.SMALL,
  distributePlanetsEvenly: true,
  quickStart: true,
  gameSpeed: engine.GameSpeed.FASTEST,
};

const mobileIds = (planet: engine.PlanetData) =>
  planet.planetaryFleet.starships
    .filter((s) => s.type !== engine.StarShipType.SystemDefense && s.type !== engine.StarShipType.SpacePlatform)
    .map((s) => s.id);

describe("grantNearestPlanetWithScout", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    setTestGalaxySeed(20261125);
    vi.spyOn(logger, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    setTestGalaxySeed(null);
    vi.restoreAllMocks();
  });

  it("grants the nearest unowned planet with one new Scout", () => {
    const { modelData, grid } = buildStartingGameModel(players(), options);
    const human = modelData.players.find((p) => p.type === engine.PlayerType.Human)!;
    const home = modelData.planets.find((p) => p.id === human.homePlanetId)!;
    const homeShipsBefore = home.planetaryFleet.starships.map((s) => s.id);
    const ownedBefore = new Set(modelData.players.flatMap((p) => p.ownedPlanetIds));

    const unowned = modelData.planets.filter((p) => !ownedBefore.has(p.id));
    const distances = unowned.map((p) => ({
      p,
      d: engine.Grid.getHexDistanceForMidPoints(grid, home.boundingHexMidPoint, p.boundingHexMidPoint),
    }));
    const minDistance = Math.min(...distances.map((x) => x.d));
    const expected = distances.filter((x) => x.d === minDistance).sort((a, b) => a.p.id - b.p.id)[0]!.p;
    const grantedShipsBefore = expected.planetaryFleet.starships.map((s) => s.id);

    const result = grantNearestPlanetWithScout(modelData);

    expect(result).toEqual({
      playerId: human.id,
      homePlanetId: home.id,
      grantedPlanetId: expected.id,
      hexDistance: minDistance,
    });
    expect(human.ownedPlanetIds).toHaveLength(2);
    expect(human.ownedPlanetIds).toContain(expected.id);
    expect(human.knownPlanetIds).toContain(expected.id);

    const granted = modelData.planets.find((p) => p.id === expected.id)!;
    expect(mobileIds(granted)).toHaveLength(1);
    const newShips = granted.planetaryFleet.starships.filter((s) => !grantedShipsBefore.includes(s.id));
    expect(newShips).toHaveLength(1);
    expect(newShips[0]!.type).toBe(engine.StarShipType.Scout);

    const allShipIds = modelData.planets.flatMap((p) => p.planetaryFleet.starships.map((s) => s.id));
    expect(new Set(allShipIds).size).toBe(allShipIds.length);

    expect(granted.planetaryFleet.compositionHash).toBe(
      engine.calculateFleetCompositionHash(granted.planetaryFleet.starships.map((s) => s.id)),
    );
    expect(home.planetaryFleet.starships.map((s) => s.id)).toEqual(homeShipsBefore);
  });

  it("throws when there is no human player", () => {
    const { modelData } = buildStartingGameModel(players(), options);
    modelData.players.forEach((p) => (p.type = engine.PlayerType.Computer_Easy));
    expect(() => grantNearestPlanetWithScout(modelData)).toThrow(/no human player/);
  });

  it("throws when every planet is owned", () => {
    const { modelData } = buildStartingGameModel(players(), options);
    const human = modelData.players.find((p) => p.type === engine.PlayerType.Human)!;
    const owned = new Set(modelData.players.flatMap((p) => p.ownedPlanetIds));
    for (const p of modelData.planets) if (!owned.has(p.id)) human.ownedPlanetIds.push(p.id);
    expect(() => grantNearestPlanetWithScout(modelData)).toThrow(/no unowned planet/);
  });
});
