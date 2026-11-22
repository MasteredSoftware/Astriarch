import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClientModelData, PlanetData, StarshipData } from 'astriarch-engine';
import { StarShipType } from 'astriarch-engine';
import { FakeNode } from './testing/fakeKonva';

// Konva's Node build needs the native `canvas` package; the fake models the
// node tree and child (z) order, which is all these tests look at.
vi.mock('konva', async () => ({ default: (await import('./testing/fakeKonva')).FakeKonva }));
const { DrawnPlanet, imageRetryDelayMs, resetImageFailureLog } = await import('./DrawnPlanet');

/** Records every image the planet requests, so a test can fire its load or error. */
class FakeImage {
	static instances: FakeImage[] = [];
	onload: (() => void) | null = null;
	onerror: ((error: unknown) => void) | null = null;
	src = '';
	constructor() {
		FakeImage.instances.push(this);
	}
}

type Internals = {
	fleetStrengthIndicator: FakeNode | null;
	spacePlatformIndicators: FakeNode | null;
	defenderStrengthIndicator: FakeNode | null;
	selectionRingOuter: FakeNode | null;
	selectionRingMiddle: FakeNode | null;
	selectionRingInner: FakeNode | null;
	planetImage: FakeNode | null;
};
const internals = (p: InstanceType<typeof DrawnPlanet>) => p as unknown as Internals;
const groupOf = (p: InstanceType<typeof DrawnPlanet>) => p.group as unknown as FakeNode;

function ship(type: StarShipType, id: number): StarshipData {
	return { id, type, health: 10 } as unknown as StarshipData;
}

function planet(starships: StarshipData[] = []): PlanetData {
	return {
		id: 1,
		name: 'Home',
		type: 3,
		originPoint: { x: 0, y: 0 },
		boundingHexMidPoint: { x: 100, y: 100 },
		buildQueue: [],
		planetaryFleet: { id: 0, starships },
		waypointBoundingHexMidPoint: null
	} as unknown as PlanetData;
}

function model(p: PlanetData, color = { r: 0, g: 128, b: 255, a: 1 }): ClientModelData {
	return {
		mainPlayer: {
			id: 'p1',
			color,
			knownPlanetIds: [p.id],
			lastKnownPlanetFleetStrength: {}
		},
		mainPlayerOwnedPlanets: { [p.id]: p },
		clientPlanets: [],
		clientPlayers: []
	} as unknown as ClientModelData;
}

const counts = () => ({ created: FakeNode.created, destroyed: FakeNode.destroyed });

describe('DrawnPlanet', () => {
	beforeEach(() => {
		FakeNode.resetCounts();
		FakeImage.instances = [];
		resetImageFailureLog();
		vi.stubGlobal('Image', FakeImage);
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('change detection', () => {
		it('creates and destroys no nodes when the model is unchanged', () => {
			const m = model(planet([ship(StarShipType.Scout, 1), ship(StarShipType.SystemDefense, 2)]));
			const drawn = new DrawnPlanet(m.mainPlayerOwnedPlanets[1]!, m);
			FakeImage.instances[0]!.onload!();
			drawn.update(m);

			const before = counts();
			drawn.update(m);
			drawn.update(m);
			expect(counts()).toEqual(before);
			expect(FakeImage.instances).toHaveLength(1);
		});

		it('rebuilds only the indicator groups when the dot count changes', () => {
			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			const others = [...groupOf(drawn).children];
			expect(internals(drawn).fleetStrengthIndicator).toBeNull();

			p.planetaryFleet.starships.push(ship(StarShipType.Scout, 1));
			const before = counts();
			drawn.update(m);

			const indicator = internals(drawn).fleetStrengthIndicator;
			expect(indicator).not.toBeNull();
			// One group plus one dot; nothing else created or destroyed
			expect(counts()).toEqual({ created: before.created + 2, destroyed: before.destroyed });
			expect(groupOf(drawn).children.filter((c) => c !== indicator)).toEqual(others);
		});

		it('rebuilds only the indicator groups when the owner colour changes', () => {
			const p = planet([ship(StarShipType.Scout, 1), ship(StarShipType.SpacePlatform, 2)]);
			const drawn = new DrawnPlanet(p, model(p));
			const oldIndicators = [
				internals(drawn).fleetStrengthIndicator,
				internals(drawn).spacePlatformIndicators
			];
			const others = groupOf(drawn).children.filter((c) => !oldIndicators.includes(c));

			const before = counts();
			drawn.update(model(p, { r: 255, g: 0, b: 0, a: 1 }));

			expect(oldIndicators.every((node) => node?.isDestroyed)).toBe(true);
			// Two groups, each with one child, destroyed and recreated
			expect(counts()).toEqual({ created: before.created + 4, destroyed: before.destroyed + 4 });
			const newIndicators = [
				internals(drawn).fleetStrengthIndicator,
				internals(drawn).spacePlatformIndicators
			];
			expect(groupOf(drawn).children.filter((c) => !newIndicators.includes(c))).toEqual(others);
		});
	});

	describe('planet image', () => {
		let now = 0;
		beforeEach(() => {
			now = 10_000;
			vi.spyOn(performance, 'now').mockImplementation(() => now);
		});
		const fail = (i: number) => FakeImage.instances[i]!.onerror!(new Error('offline'));

		it('retries after a delay once a load failed', () => {
			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			expect(FakeImage.instances).toHaveLength(1);

			drawn.update(m);
			expect(FakeImage.instances).toHaveLength(1); // still loading

			fail(0);
			drawn.update(m);
			expect(FakeImage.instances).toHaveLength(1); // backing off

			now += 1000;
			drawn.update(m);
			expect(FakeImage.instances).toHaveLength(2);

			FakeImage.instances[1]!.onload!();
			expect(internals(drawn).planetImage).not.toBeNull();
		});

		it('creates no image before the retry time, however often it updates', () => {
			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			fail(0);
			for (let t = 0; t < 999; t += 200) {
				now = 10_000 + t;
				drawn.update(m);
			}
			expect(FakeImage.instances).toHaveLength(1);
		});

		it('doubles the delay after each failure, up to 30s', () => {
			expect([1, 2, 3, 4, 5, 6, 7, 20].map(imageRetryDelayMs)).toEqual([
				1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000
			]);

			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			for (const delay of [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]) {
				const images = FakeImage.instances.length;
				fail(images - 1);
				now += delay - 1;
				drawn.update(m);
				expect(FakeImage.instances).toHaveLength(images);
				now += 1;
				drawn.update(m);
				expect(FakeImage.instances).toHaveLength(images + 1);
			}
		});

		it('loads a new planet type at once, even while backing off', () => {
			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			fail(0);
			p.type = 4;
			drawn.update(m);
			expect(FakeImage.instances).toHaveLength(2);
		});

		it('logs only the first failure of an image', () => {
			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			for (let i = 0; i < 4; i++) {
				fail(i);
				now += 30_000;
				drawn.update(m);
			}
			expect(FakeImage.instances).toHaveLength(5);
			expect(console.error).toHaveBeenCalledTimes(1);

			// Another planet with the same image doesn't log it again
			const other = planet();
			new DrawnPlanet(other, model(other));
			fail(5);
			expect(console.error).toHaveBeenCalledTimes(1);
		});

		it('forgets the backoff after a successful load', () => {
			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			fail(0);
			now += 1000;
			drawn.update(m);
			fail(1); // type 3 now backs off for 2s

			p.type = 4;
			drawn.update(m);
			FakeImage.instances[2]!.onload!();

			// Back to type 3 within those 2s: it loads at once
			p.type = 3;
			drawn.update(m);
			expect(FakeImage.instances).toHaveLength(4);
		});

		it('ignores a load superseded by a newer planet type', () => {
			const p = planet();
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			p.type = 4;
			drawn.update(m);
			expect(FakeImage.instances).toHaveLength(2);

			FakeImage.instances[0]!.onload!();
			expect(internals(drawn).planetImage).toBeNull();
			// A superseded failure doesn't trigger a retry either
			FakeImage.instances[0]!.onerror!(new Error('late'));
			drawn.update(m);
			expect(FakeImage.instances).toHaveLength(2);

			FakeImage.instances[1]!.onload!();
			expect(internals(drawn).planetImage).not.toBeNull();
		});

		it('adds no node when an image loads after the planet was destroyed', () => {
			const p = planet();
			const drawn = new DrawnPlanet(p, model(p));
			drawn.destroy();

			const before = counts();
			FakeImage.instances[0]!.onload!();
			expect(counts()).toEqual(before);
			expect(internals(drawn).planetImage).toBeNull();
		});
	});

	describe('z-order', () => {
		function expectIndicatorsAboveRings(drawn: InstanceType<typeof DrawnPlanet>) {
			const i = internals(drawn);
			const rings = [i.selectionRingOuter, i.selectionRingMiddle, i.selectionRingInner];
			const indicators = [
				i.fleetStrengthIndicator,
				i.spacePlatformIndicators,
				i.defenderStrengthIndicator
			];
			expect(rings.every((r) => r !== null)).toBe(true);
			expect(indicators.every((g) => g !== null)).toBe(true);
			const topRing = Math.max(...rings.map((r) => r!.zIndex()));
			for (const indicator of indicators) {
				expect(indicator!.zIndex()).toBeGreaterThan(topRing);
			}
		}

		it('draws strength indicators above the selection rings', () => {
			const p = planet([
				ship(StarShipType.Scout, 1),
				ship(StarShipType.SystemDefense, 2),
				ship(StarShipType.SpacePlatform, 3)
			]);
			const m = model(p);
			const drawn = new DrawnPlanet(p, m);
			drawn.setSelected(true);
			expectIndicatorsAboveRings(drawn);

			// Still true after the indicators are rebuilt
			drawn.update(model(p, { r: 255, g: 0, b: 0, a: 1 }));
			expectIndicatorsAboveRings(drawn);

			// And after deselecting and selecting again
			drawn.setSelected(false);
			drawn.setSelected(true);
			expectIndicatorsAboveRings(drawn);
		});
	});
});
