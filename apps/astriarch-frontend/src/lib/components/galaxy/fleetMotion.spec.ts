import { describe, it, expect } from 'vitest';
import type { FleetData } from 'astriarch-engine';
import {
	Fleet,
	GameController,
	GameSpeed,
	MS_PER_TICK,
	Player,
	PlayerType,
	ResearchType,
	playerColors
} from 'astriarch-engine';
import {
	FleetMotion,
	MAX_EXTRAPOLATION_MS,
	fleetParsecsPerMs,
	shouldRunFleetAnimation
} from './fleetMotion';

// 0.001 parsecs per ms = 0.2 parsecs per tick, easy to reason about
const SPEED = 0.001;

describe('FleetMotion', () => {
	it('has no position before the first record', () => {
		const motion = new FleetMotion();
		expect(motion.parsecsAt(0)).toBeNull();
		expect(motion.isMoving(0)).toBe(false);
	});

	it('extrapolates linearly at the given speed', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 1000);
		expect(motion.parsecsAt(1000)).toBe(5);
		expect(motion.parsecsAt(1100)).toBeCloseTo(4.9);
		expect(motion.parsecsAt(1000 + MS_PER_TICK)).toBeCloseTo(4.8);
	});

	it('never extrapolates before the anchor time', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 1000);
		expect(motion.parsecsAt(900)).toBe(5);
	});

	it('stops extrapolating at MAX_EXTRAPOLATION_MS', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 1000);
		const capped = 5 - SPEED * MAX_EXTRAPOLATION_MS;
		expect(motion.parsecsAt(1000 + MAX_EXTRAPOLATION_MS)).toBeCloseTo(capped);
		expect(motion.parsecsAt(1000 + MAX_EXTRAPOLATION_MS * 10)).toBeCloseTo(capped);
	});

	it('never goes below 0', () => {
		const motion = new FleetMotion();
		motion.record(0.05, SPEED, 0);
		expect(motion.parsecsAt(MAX_EXTRAPOLATION_MS)).toBe(0);
	});

	it('re-anchors on a server sync between ticks without changing the speed', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		// A sync lands 150ms after the tick, slightly ahead of the client
		motion.record(4.84, SPEED, 150);
		expect(motion.parsecsAt(150)).toBe(4.84);
		// 50ms later it has moved at the engine speed, not (5 - 4.84) / 150ms
		expect(motion.parsecsAt(200)).toBeCloseTo(4.79);
	});

	it('does not re-anchor on a repeat of the same distance', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		motion.record(5, SPEED, 100);
		expect(motion.parsecsAt(100)).toBeCloseTo(4.9);
		expect(motion.isMoving(MAX_EXTRAPOLATION_MS)).toBe(false);
	});

	it('stops moving after a pause and starts again on the next record, with no speed spike', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		expect(motion.isMoving(MAX_EXTRAPOLATION_MS - 1)).toBe(true);
		expect(motion.isMoving(MAX_EXTRAPOLATION_MS)).toBe(false);

		// Resume 10s later: the first tick moves the fleet one tick's worth
		motion.record(4.8, SPEED, 10_000);
		expect(motion.isMoving(10_000)).toBe(true);
		expect(motion.parsecsAt(10_000 + MS_PER_TICK)).toBeCloseTo(4.6);
	});

	it('does not move without distance left or without a speed', () => {
		const arrived = new FleetMotion();
		arrived.record(0, SPEED, 0);
		expect(arrived.isMoving(0)).toBe(false);

		const stalled = new FleetMotion();
		stalled.record(5, 0, 0);
		expect(stalled.isMoving(0)).toBe(false);
		expect(stalled.parsecsAt(100)).toBe(5);
	});

	it('forgets its position when the distance becomes unknown', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		motion.record(null, SPEED, 50);
		expect(motion.parsecsAt(50)).toBeNull();
		expect(motion.isMoving(50)).toBe(false);
	});
});

describe('FleetMotion.parsecsBeforeNextTick', () => {
	it('is the speed over MS_PER_TICK from the model position', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		expect(motion.parsecsBeforeNextTick(5)).toBeCloseTo(SPEED * MS_PER_TICK);
		// It matches how far parsecsAt() gets when the next tick is due
		expect(5 - (motion.parsecsAt(MS_PER_TICK) ?? 0)).toBeCloseTo(motion.parsecsBeforeNextTick(5));
	});

	it('is one tick, not MAX_EXTRAPOLATION_MS: the next tick resets the drawn position', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		expect(MAX_EXTRAPOLATION_MS).toBeGreaterThan(MS_PER_TICK);
		expect(motion.parsecsBeforeNextTick(5)).toBeLessThan(SPEED * MAX_EXTRAPOLATION_MS);
	});

	it('shrinks by what was already drawn this tick', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		const drawnAt120 = motion.parsecsAt(120) ?? 0;
		expect(motion.parsecsBeforeNextTick(drawnAt120)).toBeCloseTo(SPEED * (MS_PER_TICK - 120));
	});

	it('is 0 once the drawn position reached or passed the next-tick position', () => {
		const motion = new FleetMotion();
		motion.record(5, SPEED, 0);
		expect(motion.parsecsBeforeNextTick(motion.parsecsAt(MS_PER_TICK) ?? 0)).toBeCloseTo(0);
		// A late tick: extrapolation went on past MS_PER_TICK
		expect(motion.parsecsBeforeNextTick(motion.parsecsAt(MAX_EXTRAPOLATION_MS) ?? 0)).toBe(0);
	});

	it('is the distance left when that is shorter', () => {
		const motion = new FleetMotion();
		motion.record(0.05, SPEED, 0);
		expect(motion.parsecsBeforeNextTick(0.05)).toBe(0.05);
	});

	it('is 0 when the position is unknown', () => {
		const motion = new FleetMotion();
		expect(motion.parsecsBeforeNextTick(5)).toBe(0);
		motion.record(5, SPEED, 0);
		motion.record(null, SPEED, 50);
		expect(motion.parsecsBeforeNextTick(5)).toBe(0);
	});
});

describe('shouldRunFleetAnimation', () => {
	const fleet = (visible: boolean) => ({
		calls: [] as [number, number][],
		canMoveVisibly(now: number, minLayerPx: number) {
			this.calls.push([now, minLayerPx]);
			return visible;
		}
	});

	it('is false without fleets', () => {
		expect(shouldRunFleetAnimation([], 0, 0.5)).toBe(false);
	});

	it('is true only if some fleet can move visibly', () => {
		expect(shouldRunFleetAnimation([fleet(false), fleet(false)], 0, 0.5)).toBe(false);
		expect(shouldRunFleetAnimation([fleet(false), fleet(true)], 0, 0.5)).toBe(true);
	});

	it('asks each fleet with the given time and threshold', () => {
		const a = fleet(false);
		shouldRunFleetAnimation([a], 123, 0.25);
		expect(a.calls).toEqual([[123, 0.25]]);
	});

	it('accepts a Map iterator', () => {
		const fleets = new Map([[1, fleet(true)]]);
		expect(shouldRunFleetAnimation(fleets.values(), 0, 0.5)).toBe(true);
	});
});

describe('fleetParsecsPerMs', () => {
	function travelingFleet(): FleetData {
		return {
			id: 1,
			starships: [],
			locationHexMidPoint: null,
			travelingFromHexMidPoint: { x: 0, y: 0 },
			destinationHexMidPoint: { x: 100, y: 0 },
			parsecsToDestination: 5,
			totalTravelDistance: 5
		};
	}

	const speeds = [
		GameSpeed.SLOWEST,
		GameSpeed.SLOW,
		GameSpeed.NORMAL,
		GameSpeed.FAST,
		GameSpeed.FASTEST
	];

	it.each(speeds)(
		'matches the distance Fleet.moveFleet covers in one tick (game speed %s)',
		(gameSpeed) => {
			const owner = Player.constructPlayer('p1', PlayerType.Human, 'P1', playerColors[0]!);
			const fleet = travelingFleet();
			const cyclesPerTick = MS_PER_TICK / GameController.GAME_SPEED_MS_PER_CYCLE[gameSpeed];
			Fleet.moveFleet(fleet, owner, cyclesPerTick);

			expect(fleetParsecsPerMs(owner, gameSpeed) * MS_PER_TICK).toBeCloseTo(
				5 - (fleet.parsecsToDestination ?? 0),
				10
			);
		}
	);

	it('follows propulsion research', () => {
		const owner = Player.constructPlayer('p1', PlayerType.Human, 'P1', playerColors[0]!);
		const base = fleetParsecsPerMs(owner, GameSpeed.NORMAL);
		owner.research.researchProgressByType[ResearchType.PROPULSION_IMPROVEMENT].data.percent = 1.5;
		expect(fleetParsecsPerMs(owner, GameSpeed.NORMAL)).toBeCloseTo(base * 1.5);
	});
});
