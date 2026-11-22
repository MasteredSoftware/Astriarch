import { describe, it, expect, vi } from 'vitest';
import type { ClientModelData, FleetData } from 'astriarch-engine';
import { GameSpeed, Player, PlayerType, playerColors } from 'astriarch-engine';
import { MAX_EXTRAPOLATION_MS } from './fleetMotion';

// Konva's Node build needs the native `canvas` package; the fake node tree is
// enough to construct a DrawnFleet.
vi.mock('konva', async () => ({ default: (await import('./testing/fakeKonva')).FakeKonva }));
const { DrawnFleet, isFleetInTransit, turnsToDestination } = await import('./DrawnFleet');

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

describe('DrawnFleet.canMoveVisibly', () => {
	// The default fleet() is 300px for 6 parsecs: 50 layer px per parsec. At
	// Normal speed (1 parsec per 30s cycle) it can move at most 0.01 parsecs =
	// 0.5 layer px before the next update; at Fastest (10s) 1.5 layer px.
	const minLayerPx = (scale: number) => 0.5 / scale;

	function drawn(gameSpeed: GameSpeed, overrides: Partial<FleetData> = {}) {
		const f = fleet(overrides);
		const mainPlayer = Player.constructPlayer('p1', PlayerType.Human, 'P1', playerColors[0]!);
		mainPlayer.fleetsInTransit = [f];
		const model = { mainPlayer, gameOptions: { gameSpeed } } as unknown as ClientModelData;
		return { fleet: new DrawnFleet(f, model), now: performance.now() };
	}

	it('is false at Normal speed when zoomed out, where a move is under the threshold', () => {
		const { fleet: d, now } = drawn(GameSpeed.NORMAL);
		expect(d.canMove(now)).toBe(true);
		expect(d.canMoveVisibly(now, minLayerPx(0.8))).toBe(false);
	});

	it('is true at Normal speed when zoomed in', () => {
		const { fleet: d, now } = drawn(GameSpeed.NORMAL);
		expect(d.canMoveVisibly(now, minLayerPx(2))).toBe(true);
	});

	it('is true at Fastest speed at the same zoom', () => {
		const { fleet: d, now } = drawn(GameSpeed.FASTEST);
		expect(d.canMoveVisibly(now, minLayerPx(0.8))).toBe(true);
	});

	it('is false once the last update is too old to extrapolate from', () => {
		const { fleet: d, now } = drawn(GameSpeed.FASTEST);
		expect(d.canMoveVisibly(now + MAX_EXTRAPOLATION_MS, minLayerPx(2))).toBe(false);
	});

	it('is false while awaiting conflict resolution, even zoomed in at Fastest', () => {
		const { fleet: d, now } = drawn(GameSpeed.FASTEST, {
			parsecsToDestination: -0.01,
			awaitingConflictResolution: true
		});
		expect(d.canMoveVisibly(now, minLayerPx(4))).toBe(false);
	});
});
