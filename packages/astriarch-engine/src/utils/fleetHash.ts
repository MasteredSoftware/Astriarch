/**
 * Simple FNV-1a hash implementation for fleet event chain tracking.
 * This is synchronous and works in both browser and Node.js environments.
 * Not cryptographically secure, but sufficient for detecting desyncs.
 */

const FNV_OFFSET_BASIS = 2166136261;

/**
 * Generate a simple hash from a string using FNV-1a algorithm.
 * Fast, deterministic, and synchronous.
 */
export function simpleHash(str: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Update fleet event chain hash when fleet composition changes.
 * @param currentHash - Current fleet hash (or empty string for new fleet)
 * @param operation - Type of operation (ADD, REMOVE, MERGE, REPLACE)
 * @param shipIds - Array of ship IDs involved in the operation
 * @returns New hash incorporating the operation
 */
export function updateFleetHash(currentHash: string, operation: string, shipIds: number[]): string {
  // Sort ship IDs to ensure deterministic hash regardless of order
  const sortedIds = [...shipIds].sort((a, b) => a - b);
  const data = `${currentHash}:${operation}:${sortedIds.join(',')}`;
  return simpleHash(data);
}

/**
 * Initialize a fleet hash based on current ship composition.
 * Used when creating a new fleet or when hash doesn't exist.
 */
export function initializeFleetHash(shipIds: number[]): string {
  return updateFleetHash('', 'INIT', shipIds);
}

/**
 * Recalculate fleet hash from scratch based on current ships.
 * Used for validation or when migrating existing fleets.
 */
export function recalculateFleetHash(shipIds: number[]): string {
  return initializeFleetHash(shipIds);
}
