import type { ClientModelData } from 'astriarch-engine';

/**
 * Keeps the main player's fleet id counter from going backwards across a full state sync.
 * A snapshot can arrive before the server has processed sends the client already allocated ids for,
 * so the client keeps the larger of the two counters when the snapshot is for the same player.
 */
export function preserveNextFleetId(
	previous: ClientModelData | null | undefined,
	updated: ClientModelData
): void {
	if (!previous || previous.mainPlayer.id !== updated.mainPlayer.id) return;
	const prev = previous.mainPlayer.nextFleetId;
	const next = updated.mainPlayer.nextFleetId;
	if (!Number.isFinite(prev)) return;
	updated.mainPlayer.nextFleetId = Number.isFinite(next) ? Math.max(next, prev) : prev;
}
