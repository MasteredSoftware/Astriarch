import { describe, it, expect, vi } from 'vitest';
import type { FleetData } from 'astriarch-engine';

// Konva's Node build needs the native `canvas` package; these tests only cover
// the pure helpers, so stub it out.
vi.mock('konva', () => ({ default: {} }));
const { isFleetInTransit, turnsToDestination } = await import('./DrawnFleet');

function fleet(overrides: Partial<FleetData> = {}): FleetData {
	return {
		id: 1,
		starships: [],
		locationHexMidPoint: null,
		travelingFromHexMidPoint: { x: 0, y: 0 },
		destinationHexMidPoint: { x: 300, y: 0 },
		parsecsToDestination: 3,
		totalTravelDistance: 6,
		...overrides
	};
}

describe('isFleetInTransit', () => {
	it('is true for a traveling fleet', () => {
		expect(isFleetInTransit(fleet())).toBe(true);
	});

	it('is false once the fleet arrived at an unowned planet and awaits conflict resolution', () => {
		// The engine overshoots slightly and keeps the fleet in fleetsInTransit
		expect(
			isFleetInTransit(fleet({ parsecsToDestination: -0.01, awaitingConflictResolution: true }))
		).toBe(false);
		expect(isFleetInTransit(fleet({ awaitingConflictResolution: true }))).toBe(false);
		expect(isFleetInTransit(fleet({ parsecsToDestination: 0 }))).toBe(false);
		expect(isFleetInTransit(fleet({ parsecsToDestination: -0.5 }))).toBe(false);
	});

	it('is false without a route', () => {
		expect(isFleetInTransit(fleet({ totalTravelDistance: 0 }))).toBe(false);
		expect(isFleetInTransit(fleet({ destinationHexMidPoint: null }))).toBe(false);
		expect(isFleetInTransit(fleet({ parsecsToDestination: null }))).toBe(false);
	});
});

describe('turnsToDestination', () => {
	it('rounds up to whole turns', () => {
		expect(turnsToDestination(3)).toBe(3);
		expect(turnsToDestination(2.1)).toBe(3);
	});

	it('never reports less than 1 turn while in transit', () => {
		expect(turnsToDestination(0.2)).toBe(1);
		expect(turnsToDestination(-0.01)).toBe(1);
	});
});
