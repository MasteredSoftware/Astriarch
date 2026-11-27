import { describe, it, expect, vi, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import { StarShipType, TaskNotificationType, type ClientModelData } from 'astriarch-engine';

// testHooks wires the real app stores in installTestHooks(); the recorder under
// test takes its stores as arguments, so stub the app modules out.
vi.mock('#lib/stores/gameStore.ts', () => ({
	clientGameModel: writable(null),
	selectedPlanetId: writable(null)
}));
vi.mock('#lib/services/websocket.ts', () => ({ webSocketService: { requestStateSync: vi.fn() } }));

import {
	allStarshipIdsOf,
	createFleetViewRecorder,
	fleetsInTransitOf,
	mobileShipIdsOf,
	taskNotificationsOf,
	waitForMobileShipCount,
	type FleetViewState
} from './testHooks';

function ship(id: string, type: StarShipType) {
	return { id, type, health: 1, experienceAmount: 0 };
}

function model(cycle: number, planetShips: Record<number, ReturnType<typeof ship>[]>) {
	const mainPlayerOwnedPlanets: Record<number, unknown> = {};
	for (const [id, starships] of Object.entries(planetShips)) {
		mainPlayerOwnedPlanets[Number(id)] = { id: Number(id), planetaryFleet: { starships } };
	}
	return {
		currentCycle: cycle,
		mainPlayer: { fleetsInTransit: [{ id: 7, parsecsToDestination: 3.5 }] },
		mainPlayerOwnedPlanets
	} as unknown as ClientModelData;
}

function setup() {
	const inner = writable<ClientModelData | null>(null);
	let active = 0;
	const cgm = {
		set: inner.set,
		subscribe(run: (v: ClientModelData | null) => void) {
			active++;
			const unsub = inner.subscribe(run);
			return () => {
				active--;
				unsub();
			};
		}
	};
	const selected = writable<number | null>(1);
	let view: FleetViewState = { viewPlanetId: null, viewShipIds: [] };
	const flush: (() => void)[] = [];
	const recorder = createFleetViewRecorder({
		model: cgm,
		selectedPlanetId: selected,
		readView: () => view,
		settle: () => new Promise<void>((resolve) => flush.push(resolve)),
		now: () => 1000
	});
	return {
		cgm,
		selected,
		recorder,
		render(next: FleetViewState) {
			view = next;
			flush.splice(0).forEach((resolve) => resolve());
		},
		subscribers: () => active
	};
}

describe('mobileShipIdsOf', () => {
	it('excludes System Defense and Space Platform ships', () => {
		const planet = {
			planetaryFleet: {
				starships: [
					ship('a', StarShipType.SystemDefense),
					ship('b', StarShipType.Scout),
					ship('c', StarShipType.SpacePlatform),
					ship('d', StarShipType.Destroyer)
				]
			}
		} as never;
		expect(mobileShipIdsOf(planet)).toEqual(['b', 'd']);
		expect(mobileShipIdsOf(undefined)).toEqual([]);
	});
});

describe('taskNotificationsOf', () => {
	it('lists every (type, planetId) pair in the index', () => {
		const t = (type: TaskNotificationType, planetId: number) => ({
			type,
			planetId,
			planetName: 'p',
			message: 'm'
		});
		const cgm = {
			taskNotifications: {
				[TaskNotificationType.BuildQueueEmpty]: { 11: t(TaskNotificationType.BuildQueueEmpty, 11) },
				[TaskNotificationType.InsufficientFood]: {},
				[TaskNotificationType.CitizensProtesting]: {
					9: t(TaskNotificationType.CitizensProtesting, 9)
				}
			}
		} as unknown as ClientModelData;
		expect(taskNotificationsOf(cgm)).toEqual([
			{ type: TaskNotificationType.BuildQueueEmpty, planetId: 11 },
			{ type: TaskNotificationType.CitizensProtesting, planetId: 9 }
		]);
		expect(taskNotificationsOf(null)).toEqual([]);
	});
});

describe('allStarshipIdsOf', () => {
	it('includes every ship type on owned planets and ships in transit', () => {
		const cgm = {
			mainPlayerOwnedPlanets: {
				1: {
					planetaryFleet: {
						starships: [ship('1_1', StarShipType.SystemDefense), ship('1_2', StarShipType.Scout)]
					}
				},
				2: { planetaryFleet: { starships: [ship('2_1', StarShipType.SpacePlatform)] } }
			},
			mainPlayer: { fleetsInTransit: [{ starships: [ship('3_1', StarShipType.Cruiser)] }] }
		} as unknown as ClientModelData;
		expect(allStarshipIdsOf(cgm).sort()).toEqual(['1_1', '1_2', '2_1', '3_1']);
		expect(allStarshipIdsOf(null)).toEqual([]);
	});
});

describe('createFleetViewRecorder', () => {
	it('pairs each model emission with the view after it settles', async () => {
		const t = setup();
		t.cgm.set(model(1, { 1: [ship('1_1', StarShipType.Scout)] }));
		t.recorder.start();
		t.render({ viewPlanetId: 1, viewShipIds: ['1_1'] });

		t.cgm.set(model(2, { 1: [ship('1_1', StarShipType.Scout), ship('2_1', StarShipType.Scout)] }));
		// The model is captured synchronously, before the view renders.
		t.render({ viewPlanetId: 1, viewShipIds: ['1_1'] });

		const samples = await t.recorder.stop();
		expect(samples).toHaveLength(2);
		expect(samples[0]).toMatchObject({
			seq: 0,
			cycle: 1,
			selectedPlanetId: 1,
			modelShipIds: ['1_1'],
			viewPlanetId: 1,
			viewShipIds: ['1_1'],
			fleetsInTransit: [{ id: 7, parsecsToDestination: 3.5 }]
		});
		expect(samples[1]).toMatchObject({
			seq: 1,
			cycle: 2,
			modelShipIds: ['1_1', '2_1'],
			viewShipIds: ['1_1']
		});
	});

	it('captures the model even if the store object is mutated later', async () => {
		const t = setup();
		const m = model(1, { 1: [ship('1_1', StarShipType.Scout)] });
		t.cgm.set(m);
		t.recorder.start();
		(m.mainPlayerOwnedPlanets[1]!.planetaryFleet.starships as unknown[]).push(
			ship('x', StarShipType.Scout)
		);
		t.render({ viewPlanetId: 1, viewShipIds: ['1_1', 'x'] });
		const [sample] = await t.recorder.stop();
		expect(sample!.modelShipIds).toEqual(['1_1']);
	});

	it('unsubscribes on stop and records nothing afterwards', async () => {
		const t = setup();
		expect(t.subscribers()).toBe(0);
		t.recorder.start();
		expect(t.subscribers()).toBe(1);
		t.render({ viewPlanetId: null, viewShipIds: [] });
		await t.recorder.stop();
		expect(t.subscribers()).toBe(0);

		t.cgm.set(model(5, {}));
		t.recorder.start();
		t.render({ viewPlanetId: null, viewShipIds: [] });
		const samples = await t.recorder.stop();
		expect(samples).toHaveLength(1);
		expect(samples[0]!.cycle).toBe(5);
	});
});

describe('waitForMobileShipCount', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves immediately when the count already matches and unsubscribes', async () => {
		const t = setup();
		t.cgm.set(model(1, { 1: [ship('1_1', StarShipType.Scout)] }));
		await expect(waitForMobileShipCount(t.cgm, 1, 1, 1_000)).resolves.toBeUndefined();
		expect(t.subscribers()).toBe(0);
	});

	it('resolves on a later emission', async () => {
		const t = setup();
		t.cgm.set(model(1, { 1: [ship('1_1', StarShipType.Scout)] }));
		let resolved = false;
		const p = waitForMobileShipCount(t.cgm, 1, 2, 1_000).then(() => {
			resolved = true;
		});
		await Promise.resolve();
		expect(resolved).toBe(false);
		expect(t.subscribers()).toBe(1);
		t.cgm.set(model(2, { 1: [ship('1_1', StarShipType.Scout), ship('2_1', StarShipType.Scout)] }));
		await p;
		expect(resolved).toBe(true);
		expect(t.subscribers()).toBe(0);
	});

	it('ignores System Defense and Space Platform ships', async () => {
		vi.useFakeTimers();
		const t = setup();
		t.cgm.set(
			model(1, {
				1: [
					ship('1_1', StarShipType.Scout),
					ship('d', StarShipType.SystemDefense),
					ship('p', StarShipType.SpacePlatform)
				]
			})
		);
		const p = waitForMobileShipCount(t.cgm, 1, 2, 1_000);
		const assertion = expect(p).rejects.toThrow(/did not reach 2 within 1000ms \(last 1\)/);
		vi.advanceTimersByTime(1_000);
		await assertion;
	});

	it('rejects after the timeout and unsubscribes', async () => {
		vi.useFakeTimers();
		const t = setup();
		t.cgm.set(model(1, {}));
		const p = waitForMobileShipCount(t.cgm, 1, 1, 500);
		const assertion = expect(p).rejects.toThrow(
			'mobile ship count on planet 1 did not reach 1 within 500ms (last 0)'
		);
		expect(t.subscribers()).toBe(1);
		vi.advanceTimersByTime(499);
		expect(t.subscribers()).toBe(1);
		vi.advanceTimersByTime(1);
		await assertion;
		expect(t.subscribers()).toBe(0);
	});
});

describe('fleetsInTransitOf', () => {
	function withFleets(fleets: unknown[]) {
		return {
			mainPlayer: { fleetsInTransit: fleets },
			clientPlanets: [
				{ id: 4, boundingHexMidPoint: { x: 10, y: 20 } },
				{ id: 5, boundingHexMidPoint: { x: 110.25, y: 220.5 } }
			]
		} as unknown as ClientModelData;
	}

	it('resolves the destination planet from the destination hex midpoint', () => {
		const cgm = withFleets([
			{ id: 1, parsecsToDestination: 2, destinationHexMidPoint: { x: 110.25, y: 220.5 } }
		]);
		expect(fleetsInTransitOf(cgm)).toEqual([
			{ id: 1, parsecsToDestination: 2, destinationPlanetId: 5 }
		]);
	});

	it('gives null for a fleet with no destination', () => {
		const cgm = withFleets([{ id: 1, parsecsToDestination: null, destinationHexMidPoint: null }]);
		expect(fleetsInTransitOf(cgm)[0]!.destinationPlanetId).toBeNull();
	});

	it('gives null when no planet matches the destination', () => {
		const cgm = withFleets([
			{ id: 1, parsecsToDestination: 2, destinationHexMidPoint: { x: 300, y: 300 } }
		]);
		expect(fleetsInTransitOf(cgm)[0]!.destinationPlanetId).toBeNull();
	});

	it('gives an empty list with no model', () => {
		expect(fleetsInTransitOf(null)).toEqual([]);
	});
});
