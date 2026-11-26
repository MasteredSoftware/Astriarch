import { describe, it, expect, vi } from 'vitest';
import { writable } from 'svelte/store';
import { StarShipType, type ClientModelData } from 'astriarch-engine';

// testHooks wires the real app stores in installTestHooks(); the recorder under
// test takes its stores as arguments, so stub the app modules out.
vi.mock('#lib/stores/gameStore.ts', () => ({
	clientGameModel: writable(null),
	selectedPlanetId: writable(null)
}));
vi.mock('#lib/services/websocket.ts', () => ({ webSocketService: { requestStateSync: vi.fn() } }));

import { createFleetViewRecorder, mobileShipIdsOf, type FleetViewState } from './testHooks';

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
