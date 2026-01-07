/**
 * State Checksum Utility
 *
 * Calculates a hash of critical client game state to verify client/server
 * have the same actual game state (beyond just event sequence matching).
 * This detects issues where events were processed but resulted in different
 * outcomes (e.g., race conditions, floating point drift, etc.)
 * Uses FNV-1a hashing for fast, deterministic, cross-platform checksums.
 */

import type { ClientModelData } from '../model/clientModel';
import type { FleetData } from '../model/fleet';
import { simpleHash } from './simpleHash';

/**
 * Calculate fleet composition hash based on ship IDs.
 * The hash is deterministic based only on which ships are present,
 * not on the order they were added or any event history.
 *
 * @param shipIds - Array of ship IDs in the fleet (planet-scoped strings)
 * @returns 8-character hex hash representing the fleet composition
 */
export function calculateFleetCompositionHash(shipIds: string[]): string {
  // Sort ship IDs to ensure deterministic hash regardless of input order
  const sortedIds = [...shipIds].sort();
  const data = `FLEET:${sortedIds.join(',')}`;
  return simpleHash(data);
}

/**
 * Extracts deterministic fleet data for checksumming.
 * Excludes ship health (regenerates continuously on client) and floating-point position data.
 */
function extractFleetChecksum(fleet: FleetData) {
  // Sort starships by ID to ensure deterministic order regardless of merge order
  const sortedStarships = fleet.starships
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      type: s.type,
      // Health excluded: regenerates deterministically on client between server ticks
    }));

  return {
    id: fleet.id,
    starships: sortedStarships,
    starshipCount: fleet.starships.length,
    compositionHash: fleet.compositionHash, // Include fleet composition hash for desync detection
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
        if (!planet) return [];
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
 *
 * Excludes timing-sensitive data like resources and research that change
 * frequently with client clock ticks and would cause false positive desyncs.
 *
 * @param clientModel The client model to checksum
 * @returns An 8-character hex string representing the game state
 */
export function calculateClientModelChecksum(clientModel: ClientModelData): string {
  const stateData = extractStateData(clientModel);
  const dataString = JSON.stringify(stateData);
  return simpleHash(dataString);
}

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

  const planetaryFleets = ownedPlanetIds
    .map((planetId) => {
      const planet = clientModel.mainPlayerOwnedPlanets[planetId];
      return planet ? {
        planetId,
        fleet: extractFleetChecksum(planet.planetaryFleet),
      } : null;
    })
    .filter((item): item is { planetId: number; fleet: ReturnType<typeof extractFleetChecksum> } => item !== null);

  // Debug logging - commented out to avoid performance impact on server game loop
  // console.log('🔍 Fleet checksum details:');
  // console.log(`  Fleets in transit: ${fleetsInTransit.length}`);
  // fleetsInTransit.forEach((f) => {
  //   console.log(
  //     `    Transit fleet: ID=${f.id}, ships=${f.starshipCount}, shipIDs=[${f.starships.map((s) => s.id).join(',')}]`,
  //   );
  // });
  // console.log(`  Planetary fleets: ${planetaryFleets.length}`);
  // planetaryFleets.forEach((pf) => {
  //   console.log(
  //     `    Planet ${pf.planetId}: fleet ID=${pf.fleet.id}, ships=${pf.fleet.starshipCount}, shipIDs=[${pf.fleet.starships.map((s) => s.id).join(',')}]`,
  //   );
  // });

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
export function calculateClientModelChecksumComponents(clientModel: ClientModelData): {
  planets: string;
  fleets: string;
} {
  const { planetsData, fleetsData } = extractComponentStateData(clientModel);

  return {
    planets: simpleHash(JSON.stringify(planetsData)),
    fleets: simpleHash(JSON.stringify(fleetsData)),
  };
}
