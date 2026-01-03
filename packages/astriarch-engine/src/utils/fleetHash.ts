/**
 * Simple FNV-1a hash implementation for fleet composition tracking.
 * This is synchronous and works in both browser and Node.js environments.
 * Not cryptographically secure, but sufficient for detecting desyncs.
 *
 * The hash is based solely on ship IDs present in the fleet (sorted order),
 * not on the sequence of events that created the fleet composition.
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
 * Calculate fleet composition hash based on ship IDs.
 * The hash is deterministic based only on which ships are present,
 * not on the order they were added or any event history.
 *
 * @param shipIds - Array of ship IDs in the fleet
 * @returns Hash representing the fleet composition
 */
export function calculateFleetCompositionHash(shipIds: number[]): string {
  // Sort ship IDs to ensure deterministic hash regardless of input order
  const sortedIds = [...shipIds].sort((a, b) => a - b);
  const data = `FLEET:${sortedIds.join(',')}`;
  return simpleHash(data);
}
