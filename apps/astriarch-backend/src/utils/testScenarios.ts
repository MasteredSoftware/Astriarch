/**
 * Test-only game-state scenarios used by the E2E routes in `routes/testRoutes.ts`.
 *
 * These mutate a stored game's ModelData directly, skipping normal gameplay (no events are
 * emitted and no event checksums are updated), so they must only ever be reachable from
 * routes registered under NODE_ENV=test.
 */

import * as engine from "astriarch-engine";

export interface GrantPlanetResult {
  playerId: string;
  homePlanetId: number;
  grantedPlanetId: number;
  /** Hex distance between the home planet and the granted planet. */
  hexDistance: number;
}

/**
 * Gives the first human player the unowned planet nearest its home planet (ties broken by
 * lowest planet id) and adds one Scout to that planet's fleet.
 */
export function grantNearestPlanetWithScout(modelData: engine.ModelData): GrantPlanetResult {
  const human = modelData.players.find((p) => p.type === engine.PlayerType.Human);
  if (!human) {
    throw new Error("grantNearestPlanetWithScout: no human player in game");
  }
  const home = modelData.planets.find((p) => p.id === human.homePlanetId);
  if (!home) {
    throw new Error(`grantNearestPlanetWithScout: home planet not found for player ${human.id}`);
  }

  const ownedIds = new Set<number>(modelData.players.flatMap((p) => p.ownedPlanetIds));
  const { grid } = engine.GameModel.constructGridWithModelData(modelData);

  let best: { planet: engine.PlanetData; distance: number } | null = null;
  for (const planet of modelData.planets) {
    if (ownedIds.has(planet.id)) continue;
    const distance = engine.Grid.getHexDistanceForMidPoints(grid, home.boundingHexMidPoint, planet.boundingHexMidPoint);
    if (!best || distance < best.distance || (distance === best.distance && planet.id < best.planet.id)) {
      best = { planet, distance };
    }
  }
  if (!best) {
    throw new Error("grantNearestPlanetWithScout: no unowned planet available");
  }

  const planet = best.planet;
  engine.GameModel.changePlanetOwner(undefined, human, planet, modelData.currentCycle);
  planet.planetaryFleet.starships.push(engine.Fleet.generateStarship(engine.StarShipType.Scout, undefined, planet));
  engine.Fleet.recalculateFleetCompositionHash(planet.planetaryFleet);

  return {
    playerId: human.id,
    homePlanetId: home.id,
    grantedPlanetId: planet.id,
    hexDistance: best.distance,
  };
}
