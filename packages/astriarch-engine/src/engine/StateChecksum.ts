/**
 * Event Checksum Utility
 *
 * Calculates a hash of game events to verify client/server are processing
 * the same event sequence. This is much simpler and more reliable than
 * checksumming entire game state which drifts due to timing.
 * Works in both Node.js and browser environments.
 */

import type { ClientEvent } from './GameCommands';
import { simpleHash } from '../utils/simpleHash';

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
export function calculateRollingEventChecksum(events: ClientEvent[], previousChecksum = ''): string {
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
  return simpleHash(dataString);
}
