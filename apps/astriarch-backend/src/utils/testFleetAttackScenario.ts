/**
 * Test-only "large fleet captures the AI home" scenario for E2E scenario G (issue #83).
 *
 * Like `testScenarios.ts`, this edits a stored game's ModelData directly (no events, no event
 * checksum update), so it must only ever be reachable from routes registered under NODE_ENV=test.
 */

import * as engine from "astriarch-engine";

/**
 * Protest level given to every citizen on the collision planet C. Protest falls by at least
 * 0.25 per cycle while no citizen is content (player.ts adjustPlayerPlanetProtestLevels), so
 * this keeps C protesting for ~40 cycles (~400s on Very Fast), well past the test.
 */
export const SEEDED_PROTEST_LEVEL = 10;
/** Food left on C so starvation cannot remove the protesters during the test. */
export const COLLISION_PLANET_FOOD = 100;

export interface FleetAttackCounts {
  scouts?: number;
  destroyers?: number;
  cruisers?: number;
  battleships?: number;
}

export const DEFAULT_FLEET_ATTACK_COUNTS: Required<FleetAttackCounts> = {
  scouts: 10,
  destroyers: 10,
  cruisers: 15,
  battleships: 12,
};

export interface FleetAttackSetupResult {
  playerId: string;
  aiPlayerId: string;
  /** Human home planet H. */
  homePlanetId: number;
  /** AI home planet T, the attack target. */
  targetPlanetId: number;
  /** S = T+2: given to the human, holds the attack fleet. */
  stagingPlanetId: number;
  /** R = T+1: given to the AI so capturing T does not destroy it and end the game. */
  aiSparePlanetId: number;
  /** C = T-2: given to the human with protesting citizens (old task key (T-2)+2 = T); not necessarily in T's system. */
  collisionPlanetId: number;
  /** Hex distance from S to T. */
  hexDistance: number;
  /** Sum of the fleet's ship health (= base strength for new ships). */
  fleetStrength: number;
  shipIds: string[];
}

/**
 * Sets up a large mixed fleet next to the first AI player's home planet T:
 * - S = T+2 and C = T-2 go to the human, R = T+1 goes to the AI (all must be unowned);
 * - S gets the fleet (default 10 Scouts, 10 Destroyers, 15 Cruisers, 12 Battleships: strength 744);
 * - every citizen on C protests (SEEDED_PROTEST_LEVEL) and C gets COLLISION_PLANET_FOOD food.
 * S, R and C are picked by id offset from T (for their old task keys), not by location.
 * Planet ids are consecutive within a system, so S = T+2 and R = T+1 are in T's system
 * only when T is the first planet of its system (and the system has at least 3 planets).
 * That holds for the scenario G seed (20261125, 4 planets per system: H=17, T=21, R=22,
 * S=23). C = T-2 = 19 is in the human's home system, not T's. With another seed or
 * planetsPerSystem, S or R can fall in another system or past the planet list (then this
 * throws), and the S-to-T hexDistance that scenario G's capture timeout uses changes. The
 * layout for the scenario G seed is pinned in testFleetAttackScenario.spec.ts.
 * Throws (naming the planet id) if a planet is missing or already owned.
 */
export function setupFleetAttack(modelData: engine.ModelData, counts: FleetAttackCounts = {}): FleetAttackSetupResult {
  const c = { ...DEFAULT_FLEET_ATTACK_COUNTS, ...stripUndefined(counts) };
  const human = modelData.players.find((p) => p.type === engine.PlayerType.Human);
  if (!human) {
    throw new Error("setupFleetAttack: no human player in game");
  }
  const ai = modelData.players.find((p) => p.type !== engine.PlayerType.Human);
  if (!ai) {
    throw new Error("setupFleetAttack: no computer player in game");
  }
  const planetById = (id: number) => modelData.planets.find((p) => p.id === id);
  const home = human.homePlanetId != null ? planetById(human.homePlanetId) : undefined;
  if (!home) {
    throw new Error(`setupFleetAttack: home planet not found for player ${human.id}`);
  }
  const target = ai.homePlanetId != null ? planetById(ai.homePlanetId) : undefined;
  if (!target || !ai.ownedPlanetIds.includes(target.id)) {
    throw new Error(`setupFleetAttack: AI home planet ${ai.homePlanetId} not found or not owned by ${ai.id}`);
  }

  const ownedIds = new Set<number>(modelData.players.flatMap((p) => p.ownedPlanetIds));
  const unowned = (id: number, role: string) => {
    const planet = planetById(id);
    if (!planet) {
      throw new Error(`setupFleetAttack: ${role} planet ${id} (relative to target ${target.id}) does not exist`);
    }
    if (ownedIds.has(id)) {
      throw new Error(`setupFleetAttack: ${role} planet ${id} (relative to target ${target.id}) is already owned`);
    }
    return planet;
  };
  const staging = unowned(target.id + 2, "staging");
  const spare = unowned(target.id + 1, "AI spare");
  const collision = unowned(target.id - 2, "collision");

  const cycle = modelData.currentCycle;
  engine.GameModel.changePlanetOwner(undefined, human, staging, cycle);
  engine.GameModel.changePlanetOwner(undefined, ai, spare, cycle);
  engine.GameModel.changePlanetOwner(undefined, human, collision, cycle);

  const ships = [
    ...engine.Fleet.generateStarships(engine.StarShipType.Scout, c.scouts, staging),
    ...engine.Fleet.generateStarships(engine.StarShipType.Destroyer, c.destroyers, staging),
    ...engine.Fleet.generateStarships(engine.StarShipType.Cruiser, c.cruisers, staging),
    ...engine.Fleet.generateStarships(engine.StarShipType.Battleship, c.battleships, staging),
  ];
  staging.planetaryFleet.starships.push(...ships);
  engine.Fleet.recalculateFleetCompositionHash(staging.planetaryFleet);

  for (const citizen of collision.population) {
    citizen.protestLevel = SEEDED_PROTEST_LEVEL;
  }
  collision.resources.food = COLLISION_PLANET_FOOD;

  const { grid } = engine.GameModel.constructGridWithModelData(modelData);
  const hexDistance = engine.Grid.getHexDistanceForMidPoints(
    grid,
    staging.boundingHexMidPoint,
    target.boundingHexMidPoint,
  );

  return {
    playerId: human.id,
    aiPlayerId: ai.id,
    homePlanetId: home.id,
    targetPlanetId: target.id,
    stagingPlanetId: staging.id,
    aiSparePlanetId: spare.id,
    collisionPlanetId: collision.id,
    hexDistance,
    fleetStrength: ships.reduce((sum, s) => sum + s.health, 0),
    shipIds: ships.map((s) => s.id),
  };
}

function stripUndefined(counts: FleetAttackCounts): FleetAttackCounts {
  return Object.fromEntries(Object.entries(counts).filter(([, v]) => v !== undefined));
}
