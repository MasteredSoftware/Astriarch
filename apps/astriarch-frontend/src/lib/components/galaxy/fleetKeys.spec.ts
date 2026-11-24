import { describe, it, expect } from 'vitest';
import type { FleetData } from 'astriarch-engine';
import { keyFleets } from './fleetKeys';

function fleet(id: number): FleetData {
	return {
		id,
		starships: [],
		locationHexMidPoint: null,
		travelingFromHexMidPoint: { x: 0, y: 0 },
		destinationHexMidPoint: { x: 100, y: 0 },
		parsecsToDestination: 2,
		totalTravelDistance: 4
	};
}

const keysOf = (fleets: FleetData[]) => keyFleets(fleets).keyed.map(([key]) => key);

describe('keyFleets', () => {
	it('keys unique fleets by their id', () => {
		const { keyed, duplicateIds } = keyFleets([fleet(1), fleet(2), fleet(5)]);
		expect(keyed.map(([key]) => key)).toEqual(['1', '2', '5']);
		expect(duplicateIds).toEqual([]);
	});

	it('keeps every fleet when ids repeat, with a derived key per repeat', () => {
		const a = fleet(3);
		const b = fleet(3);
		const c = fleet(3);
		const { keyed, duplicateIds } = keyFleets([fleet(1), a, b, c]);
		expect(keyed).toEqual([
			['1', expect.objectContaining({ id: 1 })],
			['3', a],
			['3#1', b],
			['3#2', c]
		]);
		expect(duplicateIds).toEqual([3]);
	});

	it('lists each duplicated id once', () => {
		const { duplicateIds } = keyFleets([fleet(3), fleet(4), fleet(3), fleet(4), fleet(3)]);
		expect(duplicateIds).toEqual([3, 4]);
	});

	it('gives the same keys across calls for the same fleets', () => {
		const fleets = [fleet(1), fleet(3), fleet(3)];
		expect(keysOf(fleets)).toEqual(keysOf(fleets));
	});

	it('drops the key of a fleet that left and restores it when the fleet returns', () => {
		// The canvas destroys DrawnFleets whose key is gone and creates one for a
		// new key, so these keys decide whether a fleet disappears and reappears.
		expect(keysOf([fleet(1), fleet(3), fleet(3)])).toEqual(['1', '3', '3#1']);
		expect(keysOf([fleet(1), fleet(3)])).toEqual(['1', '3']);
		expect(keysOf([fleet(1)])).toEqual(['1']);
		expect(keysOf([fleet(1), fleet(3)])).toEqual(['1', '3']);
	});
});
