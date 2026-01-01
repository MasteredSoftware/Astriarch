/**
 * State Checksum Utility
 *
 * Calculates a hash of critical client game state to verify client/server
 * have the same actual game state (beyond just event sequence matching).
 * This detects issues where events were processed but resulted in different
 * outcomes (e.g., race conditions, floating point drift, etc.)
 * Works in both Node.js and browser environments.
 */

import type { ClientModelData } from '../model/clientModel';
import type { FleetData } from '../model/fleet';

/**
 * Calculate SHA256 hash using Node.js crypto (server-side) - SYNC version
 * Only available in Node.js environments (not browser)
 */
function calculateHashNodeSync(data: string): string {
  // Use dynamic require to avoid bundler issues in client builds
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Calculate SHA256 hash using Node.js crypto (server-side)
 */
async function calculateHashNode(data: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Calculate SHA256 hash using Web Crypto API (browser-side)
 */
async function calculateHashBrowser(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts deterministic fleet data for checksumming.
 * Excludes floating-point position data that may have minor precision differences.
 */
function extractFleetChecksum(fleet: FleetData) {
  // Sort starships by ID to ensure deterministic order regardless of merge order
  const sortedStarships = fleet.starships
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((s) => ({
      id: s.id,
      type: s.type,
      health: Math.floor(s.health), // Floor to avoid float precision issues
    }));

  return {
    id: fleet.id,
    starships: sortedStarships,
    starshipCount: fleet.starships.length,
    // Use null checks for location - we only care if destination exists, not exact parsecs
    hasDestination: fleet.destinationHexMidPoint !== null,
    destinationX: fleet.destinationHexMidPoint ? Math.round(fleet.destinationHexMidPoint.x) : null,
    destinationY: fleet.destinationHexMidPoint ? Math.round(fleet.destinationHexMidPoint.y) : null,
  };
}

/**
 * Extracts deterministic planet data for checksumming.
 * Focuses on ownership and critical state, not full planet details.
 */
function extractPlanetChecksum(planetId: number, ownerId: string) {
  return {
    planetId,
    ownerId,
  };
}

/**
 * Extract the deterministic state data object from client model.
 * This is the common logic used by both sync and async checksum calculations.
 */
function extractStateData(clientModel: ClientModelData) {
  return {
    // Main player identification
    mainPlayerId: clientModel.mainPlayer.id,

    // Owned planets (sorted for deterministic order)
    ownedPlanets: clientModel.mainPlayer.ownedPlanetIds
      .slice()
      .sort((a, b) => a - b)
      .map((planetId) => extractPlanetChecksum(planetId, clientModel.mainPlayer.id)),

    // Fleets in transit (sorted by fleet ID)
    fleetsInTransit: clientModel.mainPlayer.fleetsInTransit
      .slice()
      .sort((a, b) => a.id - b.id)
      .map(extractFleetChecksum),

    // Planetary fleets and outgoing fleets (sorted by planet ID)
    planetaryFleets: Object.keys(clientModel.mainPlayerOwnedPlanets)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap((planetId) => {
        const planet = clientModel.mainPlayerOwnedPlanets[planetId];
        const fleets: (ReturnType<typeof extractFleetChecksum> & { location: string; planetId: number })[] = [];

        // Planetary stationed fleet
        if (planet.planetaryFleet && planet.planetaryFleet.starships.length > 0) {
          fleets.push({
            ...extractFleetChecksum(planet.planetaryFleet),
            location: 'planet',
            planetId,
          });
        }

        // Outgoing fleets from this planet
        planet.outgoingFleets
          .slice()
          .sort((a, b) => a.id - b.id)
          .forEach((fleet) => {
            fleets.push({
              ...extractFleetChecksum(fleet),
              location: 'outgoing',
              planetId,
            });
          });

        return fleets;
      }),

    // Note: Resources, research progress, and player points are excluded
    // as they change frequently with client clock ticks and can cause
    // false positive desyncs
  };
}

/**
 * Calculate a checksum of critical client model state.
 *
 * This creates a hash of the key game state elements that should be identical
 * between client and server:
 * - Owned planet IDs
 * - Fleet positions and compositions (in transit and on planets)
 * - Player resources
 * - Game time
 * - Research progress
 *
 * Excludes timing-sensitive data like lastUpdateTime that would cause
 * false positive desyncs.
 *
 * @param clientModel The client model to checksum
 * @returns A short hex string representing the game state
 */
export async function calculateClientModelChecksum(clientModel: ClientModelData): Promise<string> {
  const stateData = extractStateData(clientModel);
  const dataString = JSON.stringify(stateData);

  // Detect environment and use appropriate hashing method
  let hash: string;
  if (typeof window === 'undefined') {
    // Node.js environment (server)
    hash = await calculateHashNode(dataString);
  } else {
    // Browser environment (client)
    hash = await calculateHashBrowser(dataString);
  }

  // Take first 16 characters for brevity (same as event checksum)
  return hash.substring(0, 16);
}

/**
 * Synchronous version of calculateClientModelChecksum for use in game loops.
 * Only works in Node.js environment (server-side).
 * Browser must use the async version.
 * This export is conditional to avoid bundling Node.js crypto in browser builds.
 */
export const calculateClientModelChecksumSync: ((clientModel: ClientModelData) => string) | undefined =
  typeof window === 'undefined'
    ? function (clientModel: ClientModelData): string {
        const stateData = extractStateData(clientModel);
        const dataString = JSON.stringify(stateData);
        const hash = calculateHashNodeSync(dataString);
        return hash.substring(0, 16);
      }
    : undefined;

/**
 * Extract component state data for debugging.
 * Returns the data structures for planets and fleets separately.
 */
function extractComponentStateData(clientModel: ClientModelData) {
  const ownedPlanetIds = Object.keys(clientModel.mainPlayerOwnedPlanets).map(Number).sort();

  const planetsData = {
    ownedPlanets: ownedPlanetIds,
  };

  const fleetsInTransit = clientModel.mainPlayer.fleetsInTransit.map(extractFleetChecksum).sort((a, b) => a.id - b.id);

  const planetaryFleets = ownedPlanetIds.map((planetId) => ({
    planetId,
    fleet: extractFleetChecksum(clientModel.mainPlayerOwnedPlanets[planetId].planetaryFleet),
  }));

  // Debug logging
  console.log('🔍 Fleet checksum details:');
  console.log(`  Fleets in transit: ${fleetsInTransit.length}`);
  fleetsInTransit.forEach((f) => {
    console.log(
      `    Transit fleet: ID=${f.id}, ships=${f.starshipCount}, shipIDs=[${f.starships.map((s) => s.id).join(',')}]`,
    );
  });
  console.log(`  Planetary fleets: ${planetaryFleets.length}`);
  planetaryFleets.forEach((pf) => {
    console.log(
      `    Planet ${pf.planetId}: fleet ID=${pf.fleet.id}, ships=${pf.fleet.starshipCount}, shipIDs=[${pf.fleet.starships.map((s) => s.id).join(',')}]`,
    );
  });

  const fleetsData = {
    fleetsInTransit,
    planetaryFleets,
  };

  return { planetsData, fleetsData };
}

/**
 * Calculate component checksums for debugging.
 * Returns individual hashes for different state categories to help
 * identify which specific part of the state diverged.
 */
export async function calculateClientModelChecksumComponents(clientModel: ClientModelData): Promise<{
  full: string;
  planets: string;
  fleets: string;
}> {
  // Full checksum
  const full = await calculateClientModelChecksum(clientModel);

  // Extract component data
  const { planetsData, fleetsData } = extractComponentStateData(clientModel);

  const hashFn = typeof window === 'undefined' ? calculateHashNode : calculateHashBrowser;

  return {
    full,
    planets: (await hashFn(JSON.stringify(planetsData))).substring(0, 16),
    fleets: (await hashFn(JSON.stringify(fleetsData))).substring(0, 16),
  };
}

/**
 * Synchronous version of calculateClientModelChecksumComponents for use in game loops.
 * Only works in Node.js environment (server-side).
 * This export is conditional to avoid bundling Node.js crypto in browser builds.
 */
export const calculateClientModelChecksumComponentsSync:
  | ((clientModel: ClientModelData) => { planets: string; fleets: string })
  | undefined =
  typeof window === 'undefined'
    ? function (clientModel: ClientModelData): { planets: string; fleets: string } {
        const { planetsData, fleetsData } = extractComponentStateData(clientModel);

        return {
          planets: calculateHashNodeSync(JSON.stringify(planetsData)).substring(0, 16),
          fleets: calculateHashNodeSync(JSON.stringify(fleetsData)).substring(0, 16),
        };
      }
    : undefined;
