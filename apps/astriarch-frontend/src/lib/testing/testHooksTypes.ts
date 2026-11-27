/**
 * Plain types for the test-only page hook (see testHooks.ts).
 *
 * This file must stay free of runtime imports and `#lib` aliases so the
 * Playwright specs (type-checked with `tsc -p e2e`) can `import type` it.
 */

export interface FleetInTransitSample {
	id: number;
	parsecsToDestination: number | null;
}

/** One clientGameModel publish, paired with the Fleet Command DOM after it rendered. */
export interface FleetViewSample {
	/** 0-based emission index since startRecording() (0 is the value current at start). */
	seq: number;
	/** Date.now() when the store emitted. */
	wallMs: number;
	/** clientGameModel.currentCycle at emission, or null with no model. */
	cycle: number | null;
	/** selectedPlanetId store value at emission. */
	selectedPlanetId: number | null;
	/** Mobile ship ids (not System Defense / Space Platform) on the selected planet in the model. */
	modelShipIds: string[];
	fleetsInTransit: FleetInTransitSample[];
	/** Planet id the Fleet Command view showed after Svelte flushed; null if not mounted. */
	viewPlanetId: number | null;
	/** Ship ids of the rendered ship cards after Svelte flushed. */
	viewShipIds: string[];
	/** Date.now() when the DOM was read. */
	viewWallMs: number;
}

export interface AstriarchTestApi {
	ownedPlanetIds(): number[];
	selectedPlanetId(): number | null;
	mobileShipIds(planetId: number): string[];
	fleetsInTransit(): FleetInTransitSample[];
	requestStateSync(): void;
	/** Subscribes to clientGameModel and records a FleetViewSample per emission. */
	startRecording(): void;
	/** Unsubscribes, waits for pending DOM reads, and returns the samples. */
	stopRecording(): Promise<FleetViewSample[]>;
	/**
	 * Resolves once the planet has `count` mobile ships in clientGameModel. Event-driven
	 * (resolved from a store subscription, no polling); rejects after `timeoutMs`.
	 */
	waitForMobileShipCount(planetId: number, count: number, timeoutMs: number): Promise<void>;
}

declare global {
	interface Window {
		/** Set before the app loads (e.g. a Playwright init script) to install the hook. */
		__ASTRIARCH_TEST__?: boolean;
		__astriarchTest?: AstriarchTestApi;
	}
}
