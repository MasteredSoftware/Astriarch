/**
 * Test-only page hook for Playwright scenarios.
 *
 * Loaded lazily from +layout.svelte only when `window.__ASTRIARCH_TEST__ === true`
 * (set by a Playwright init script), so production never fetches this chunk.
 *
 * Event-driven: recording subscribes to clientGameModel only between
 * startRecording() and stopRecording(); there is no timer or rAF polling.
 */

import { get, type Readable } from 'svelte/store';
import { tick } from 'svelte';
import { StarShipType, type ClientModelData, type PlanetData } from 'astriarch-engine';
import { clientGameModel, selectedPlanetId } from '#lib/stores/gameStore.ts';
import { webSocketService } from '#lib/services/websocket.ts';
import type {
	AstriarchTestApi,
	FleetInTransitSample,
	FleetViewSample
} from '#lib/testing/testHooksTypes.ts';

/** Same filter as FleetCommandView's `ships` ("ALL" tab). */
export function mobileShipIdsOf(planet: PlanetData | undefined | null): string[] {
	if (!planet) return [];
	return planet.planetaryFleet.starships
		.filter((s) => s.type !== StarShipType.SystemDefense && s.type !== StarShipType.SpacePlatform)
		.map((s) => s.id);
}

export function fleetsInTransitOf(cgm: ClientModelData | null): FleetInTransitSample[] {
	return (cgm?.mainPlayer.fleetsInTransit ?? []).map((f) => ({
		id: f.id,
		parsecsToDestination: f.parsecsToDestination
	}));
}

export interface FleetViewState {
	viewPlanetId: number | null;
	viewShipIds: string[];
}

/** Reads what the Fleet Command view currently renders. */
export function readFleetView(root: ParentNode = document): FleetViewState {
	const view = root.querySelector('[data-testid="view-fleet-command"]');
	if (!view) return { viewPlanetId: null, viewShipIds: [] };
	const attr = view.getAttribute('data-selected-planet-id');
	const viewPlanetId = attr ? Number(attr) : null;
	const viewShipIds = Array.from(view.querySelectorAll('[data-testid="ship-card"]')).map(
		(el) => el.getAttribute('data-ship-id') ?? ''
	);
	return { viewPlanetId, viewShipIds };
}

export interface FleetViewRecorderDeps {
	model: Readable<ClientModelData | null>;
	selectedPlanetId: Readable<number | null>;
	readView: () => FleetViewState;
	/** Resolves once the UI has rendered the latest store values (Svelte's tick()). */
	settle: () => Promise<void>;
	now?: () => number;
}

export interface FleetViewRecorder {
	start(): void;
	stop(): Promise<FleetViewSample[]>;
}

export function createFleetViewRecorder(deps: FleetViewRecorderDeps): FleetViewRecorder {
	const now = deps.now ?? Date.now;
	let unsubscribe: (() => void) | null = null;
	let samples: FleetViewSample[] = [];
	let pending: Promise<void>[] = [];

	function onEmit(cgm: ClientModelData | null) {
		const planetId = get(deps.selectedPlanetId);
		// Capture the model synchronously: the store publishes a mutable object.
		const sample: FleetViewSample = {
			seq: samples.length,
			wallMs: now(),
			cycle: cgm?.currentCycle ?? null,
			selectedPlanetId: planetId,
			modelShipIds:
				cgm && planetId !== null ? mobileShipIdsOf(cgm.mainPlayerOwnedPlanets[planetId]) : [],
			fleetsInTransit: fleetsInTransitOf(cgm),
			viewPlanetId: null,
			viewShipIds: [],
			viewWallMs: 0
		};
		samples.push(sample);
		pending.push(
			deps.settle().then(() => {
				const view = deps.readView();
				sample.viewPlanetId = view.viewPlanetId;
				sample.viewShipIds = view.viewShipIds;
				sample.viewWallMs = now();
			})
		);
	}

	return {
		start() {
			if (unsubscribe) return;
			samples = [];
			pending = [];
			unsubscribe = deps.model.subscribe(onEmit);
		},
		async stop() {
			unsubscribe?.();
			unsubscribe = null;
			await Promise.all(pending);
			const result = samples;
			samples = [];
			pending = [];
			return result;
		}
	};
}

export function installTestHooks(): void {
	if (window.__astriarchTest) return;
	const recorder = createFleetViewRecorder({
		model: clientGameModel,
		selectedPlanetId,
		readView: () => readFleetView(document),
		settle: tick
	});
	const api: AstriarchTestApi = {
		ownedPlanetIds: () => get(clientGameModel)?.mainPlayer.ownedPlanetIds.slice() ?? [],
		selectedPlanetId: () => get(selectedPlanetId),
		mobileShipIds: (planetId) =>
			mobileShipIdsOf(get(clientGameModel)?.mainPlayerOwnedPlanets[planetId]),
		fleetsInTransit: () => fleetsInTransitOf(get(clientGameModel)),
		requestStateSync: () => webSocketService.requestStateSync(),
		startRecording: () => recorder.start(),
		stopRecording: () => recorder.stop()
	};
	window.__astriarchTest = api;
	console.info('[test] window.__astriarchTest installed');
}
