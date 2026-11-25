import { describe, it, expect } from 'vitest';
import type { ClientModelData } from 'astriarch-engine';
import { preserveNextFleetId } from './fleetIdCounter';

function model(playerId: string, nextFleetId: number): ClientModelData {
	return { mainPlayer: { id: playerId, nextFleetId } } as unknown as ClientModelData;
}

describe('preserveNextFleetId', () => {
	it('keeps the larger local counter for the same player', () => {
		const updated = model('me', 4);
		preserveNextFleetId(model('me', 9), updated);
		expect(updated.mainPlayer.nextFleetId).toBe(9);
	});

	it('takes the server counter when it is ahead', () => {
		const updated = model('me', 12);
		preserveNextFleetId(model('me', 9), updated);
		expect(updated.mainPlayer.nextFleetId).toBe(12);
	});

	it('does nothing for a different player or no previous model', () => {
		const other = model('me', 4);
		preserveNextFleetId(model('someone-else', 9), other);
		expect(other.mainPlayer.nextFleetId).toBe(4);

		const fresh = model('me', 4);
		preserveNextFleetId(null, fresh);
		expect(fresh.mainPlayer.nextFleetId).toBe(4);
	});

	it('repairs a missing server counter from the previous model', () => {
		const updated = model('me', Number.NaN);
		preserveNextFleetId(model('me', 6), updated);
		expect(updated.mainPlayer.nextFleetId).toBe(6);
	});
});
