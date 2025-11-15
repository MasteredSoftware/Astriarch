/**
 * Event Checksum Utility
 *
 * Calculates a hash of game events to verify client/server are processing
 * the same event sequence. This is much simpler and more reliable than
 * checksumming entire game state which drifts due to timing.
 * Works in both Node.js and browser environments.
 */

import type { ClientEvent } from './GameCommands';

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
 * Calculate a rolling checksum that chains with the previous checksum.
 *
 * This creates a cumulative hash similar to blockchain - each checksum includes
 * the previous checksum in its calculation, creating an unbreakable chain.
 * If any events are dropped, duplicated, or reordered, the chain will break
 * and desync will be detected.
 *
 * @param events Array of events to checksum
 * @param previousChecksum The checksum from the previous batch (empty string for first batch)
 * @returns A short hex string representing the chained event sequence
 */
export async function calculateRollingEventChecksum(events: ClientEvent[], previousChecksum = ''): Promise<string> {
  // Include previous checksum to chain the history
  const data = {
    previousChecksum,
    events: events.map((event) => ({
      type: event.type,
      affectedPlayerIds: event.affectedPlayerIds.sort(), // Sort for deterministic order
      data: event.data,
    })),
  };

  const dataString = JSON.stringify(data);

  // Detect environment and use appropriate hashing method
  let hash: string;
  if (typeof window === 'undefined') {
    // Node.js environment (server)
    hash = await calculateHashNode(dataString);
  } else {
    // Browser environment (client)
    hash = await calculateHashBrowser(dataString);
  }

  // Take first 16 characters for brevity
  return hash.substring(0, 16);
}
