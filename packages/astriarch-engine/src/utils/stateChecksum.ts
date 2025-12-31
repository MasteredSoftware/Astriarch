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
  return {
    id: fleet.id,
    starshipIds: fleet.starships.map((s) => s.id).sort((a, b) => a - b),
    starshipTypes: fleet.starships.map((s) => s.type).sort((a, b) => a - b),
    starshipHealths: fleet.starships.map((s) => Math.floor(s.health)).sort((a, b) => a - b), // Floor to avoid float precision issues
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
  // Build deterministic state object
  const stateData = {
    // Current game cycle (critical timing state)
    currentCycle: clientModel.currentCycle,

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

    // Player total resources (from owned planets)
    playerResources: Object.values(clientModel.mainPlayerOwnedPlanets).reduce(
      (total, planet) => ({
        food: total.food + Math.floor(planet.resources.food),
        energy: total.energy + Math.floor(planet.resources.energy),
        ore: total.ore + Math.floor(planet.resources.ore),
        iridium: total.iridium + Math.floor(planet.resources.iridium),
        production: total.production + Math.floor(planet.resources.production),
        research: total.research + Math.floor(planet.resources.research),
      }),
      { food: 0, energy: 0, ore: 0, iridium: 0, production: 0, research: 0 },
    ),

    // Research progress (critical game state)
    research: {
      researchTypeInQueue: clientModel.mainPlayer.research.researchTypeInQueue,
      researchPercent: Math.floor(clientModel.mainPlayer.research.researchPercent * 100) / 100, // Round to 2 decimals
      // Track completed research levels for each type
      researchLevels: Object.entries(clientModel.mainPlayer.research.researchProgressByType)
        .map(([type, progress]) => ({
          type: Number(type),
          level: progress.currentResearchLevel,
        }))
        .sort((a, b) => a.type - b.type),
    },

    // Player points and destroyed status
    playerStatus: {
      points: clientModel.mainPlayer.points,
      destroyed: clientModel.mainPlayer.destroyed,
    },
  };

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
 * Calculate component checksums for debugging.
 * Returns individual hashes for different state categories to help
 * identify which specific part of the state diverged.
 */
export async function calculateClientModelChecksumComponents(clientModel: ClientModelData): Promise<{
  full: string;
  planets: string;
  fleets: string;
  resources: string;
  research: string;
}> {
  // Full checksum
  const full = await calculateClientModelChecksum(clientModel);

  // Individual component checksums
  const planetsData = JSON.stringify({
    ownedPlanets: clientModel.mainPlayer.ownedPlanetIds.slice().sort((a, b) => a - b),
  });

  const fleetsData = JSON.stringify({
    fleetsInTransit: clientModel.mainPlayer.fleetsInTransit.map(extractFleetChecksum).sort((a, b) => a.id - b.id),
  });

  const resourcesData = JSON.stringify({
    playerResources: Object.values(clientModel.mainPlayerOwnedPlanets).reduce(
      (total, planet) => ({
        food: total.food + Math.floor(planet.resources.food),
        energy: total.energy + Math.floor(planet.resources.energy),
        ore: total.ore + Math.floor(planet.resources.ore),
        iridium: total.iridium + Math.floor(planet.resources.iridium),
      }),
      { food: 0, energy: 0, ore: 0, iridium: 0 },
    ),
  });

  const researchData = JSON.stringify({
    researchTypeInQueue: clientModel.mainPlayer.research.researchTypeInQueue,
    researchPercent: Math.floor(clientModel.mainPlayer.research.researchPercent * 100) / 100,
  });

  const hashFn = typeof window === 'undefined' ? calculateHashNode : calculateHashBrowser;

  return {
    full,
    planets: (await hashFn(planetsData)).substring(0, 16),
    fleets: (await hashFn(fleetsData)).substring(0, 16),
    resources: (await hashFn(resourcesData)).substring(0, 16),
    research: (await hashFn(researchData)).substring(0, 16),
  };
}
