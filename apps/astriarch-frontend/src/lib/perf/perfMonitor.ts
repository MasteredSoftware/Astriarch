/**
 * Performance instrumentation for benchmarking (see performance_improvements_plan.md).
 *
 * Off by default. Enable by loading the app with `?perf=1`, or by setting
 * `window.__ASTRIARCH_PERF__ = true` before the app loads (the Playwright perf
 * harness does this via addInitScript). When disabled every hook is a single
 * boolean check, so it is safe to leave in hot paths.
 *
 * When enabled, `window.__perf` exposes:
 *   - reset(options?)  start a fresh measurement window
 *   - snapshot()       metrics collected since the last reset
 *
 * Metrics:
 *   - timings:  named durations (count, total, mean, p50/p95/p99, max) in ms
 *   - counters: named event counts, plus per-second rates
 *   - frames:   rAF frame-interval distribution and dropped frames relative to
 *               the display refresh interval (only while sampleFrames is on).
 *               The sampler is its own rAF loop, so it is off by default to keep
 *               idle measurements honest. Once rendering is event-driven it is
 *               the only steady rAF loop in a window that enables it: it keeps
 *               the browser's refresh driver ticking (adding CPU, notably in
 *               Firefox) and `fps` reads the display rate whether or not
 *               anything was drawn. Use `renderedFrames` for what was drawn.
 *   - renderedFrames: display frames in which at least one Konva layer drew.
 *               A layer draw arms a one-shot rAF; when it fires, every draw
 *               since the previous one counts as one frame at that rAF's
 *               timestamp. Nothing is scheduled while nothing draws, so it is
 *               available in every window including idle, and it can never
 *               exceed the display refresh rate. Null unless the stage is live
 *               and every layer is hooked (see konva.registered).
 *   - konva:    nodes created/destroyed, current node count, per-layer draws.
 *               `registered` is true only while the registered stage is still
 *               attached to the document and every layer on it is hooked, so a
 *               stale or partly hooked stage reads as unregistered (budgets
 *               then report MISSING rather than a false 0).
 *   - heap / longTasks: where the browser supports them (Chromium)
 */

import type Konva from 'konva';

type KonvaModule = typeof Konva;

declare global {
	interface Window {
		__ASTRIARCH_PERF__?: boolean;
		__perf?: PerfApi;
	}
}

export interface TimingSummary {
	count: number;
	totalMs: number;
	meanMs: number;
	p50Ms: number;
	p95Ms: number;
	p99Ms: number;
	maxMs: number;
}

export interface FrameSummary {
	count: number;
	fps: number;
	p50Ms: number;
	p95Ms: number;
	p99Ms: number;
	maxMs: number;
	/**
	 * Display refresh interval the intervals are judged against: the
	 * refreshIntervalMs passed to reset(), else the median sampled interval.
	 */
	periodMs: number;
	/** Display refreshes with no frame: sum of max(0, round(interval / period) - 1). */
	droppedFrames: number;
	/** Intervals longer than 1.5 periods. */
	slowOver1_5x: number;
}

/** Frames in which at least one registered Konva layer drew. */
export interface RenderedFrameSummary {
	count: number;
	fps: number;
	/** Interval stats between rendered frames; null with fewer than two frames. */
	p50Ms: number | null;
	p95Ms: number | null;
	maxMs: number | null;
}

export interface PerfSnapshot {
	elapsedMs: number;
	timings: Record<string, TimingSummary>;
	counters: Record<string, number>;
	ratesPerSec: Record<string, number>;
	frames: FrameSummary | null;
	/** Null when no Konva stage is registered. */
	renderedFrames: RenderedFrameSummary | null;
	konva: {
		/**
		 * True when perfRegisterKonvaStage was called for a stage that is still
		 * attached to the document and every layer on it is hooked.
		 */
		registered: boolean;
		/** Draw counter names (`konva.draw.<layer>`) of the registered layers. */
		layers: string[] | null;
		/**
		 * Draw counter names of layers on the stage that are not hooked (added
		 * after registration); null when no stage was registered.
		 */
		unhookedLayers: string[] | null;
		nodesCreated: number | null;
		nodesDestroyed: number;
		nodeCount: number | null;
		layerCount: number | null;
	};
	heapUsedBytes: number | null;
	longTasks: { count: number; totalMs: number } | null;
	devicePixelRatio: number;
	userAgent: string;
}

export interface ResetOptions {
	/** Run a rAF loop to record frame intervals during this window. */
	sampleFrames?: boolean;
	/**
	 * Measured display refresh interval (ms), used to count dropped frames.
	 * Defaults to the median sampled frame interval.
	 */
	refreshIntervalMs?: number;
}

export interface PerfApi {
	enabled: true;
	reset(options?: ResetOptions): void;
	snapshot(): PerfSnapshot;
}

const MAX_SAMPLES = 200_000;

export const perfEnabled: boolean =
	typeof window !== 'undefined' &&
	(window.__ASTRIARCH_PERF__ === true || /[?&]perf=1(&|$)/.test(window.location.search));

let windowStart = 0;
let timings = new Map<string, number[]>();
let counters = new Map<string, number>();
let frameIntervals: number[] = [];
let frameRafId: number | null = null;
let lastFrameTs: number | null = null;
let refreshIntervalMs: number | null = null;
let renderedFrameCount = 0;
let renderedFrameIntervals: number[] = [];
let lastRenderedFrameTs: number | null = null;
/** One-shot rAF armed by the first layer draw since the last rendered frame. */
let renderedFrameRafId: number | null = null;
let konvaNodesDestroyed = 0;
let longTaskCount = 0;
let longTaskTotalMs = 0;

let konvaModule: KonvaModule | null = null;
let konvaStage: Konva.Stage | null = null;
let konvaStartId: number | null = null;
/** Probe nodes created since konvaStartId was taken (they are not app work). */
let probesSinceStart = 0;
const layerDrawStart = new WeakMap<object, number>();
/** Layers that already have the perf draw handlers, so they are hooked once. */
const hookedLayers = new WeakSet<object>();
/**
 * Draw counters of the registered layers. reset() sets each to 0, so a layer
 * that is never drawn reports an explicit 0 rather than a missing metric.
 */
const registeredLayerLabels = new Set<string>();

/** Returns a start timestamp, or 0 when perf is disabled. Pair with perfEnd. */
export function perfStart(): number {
	return perfEnabled ? performance.now() : 0;
}

/** Records the time since `start` under `name`. No-op when perf is disabled. */
export function perfEnd(name: string, start: number): void {
	if (!perfEnabled) return;
	recordTiming(name, performance.now() - start);
}

/** Increments counter `name` by `n`. No-op when perf is disabled. */
export function perfCount(name: string, n = 1): void {
	if (!perfEnabled) return;
	counters.set(name, (counters.get(name) ?? 0) + n);
}

function recordTiming(name: string, ms: number): void {
	let samples = timings.get(name);
	if (!samples) {
		samples = [];
		timings.set(name, samples);
	}
	if (samples.length < MAX_SAMPLES) samples.push(ms);
}

/**
 * Wraps a Svelte store so every set/update is counted and the synchronous
 * subscriber fan-out is timed as `store.<name>.fanout`. Returns the store
 * unchanged when perf is disabled.
 */
export function instrumentStore<
	T,
	S extends { set(value: T): void; update(fn: (value: T) => T): void }
>(name: string, store: S): S {
	if (!perfEnabled) return store;
	const originalSet = store.set.bind(store);
	const originalUpdate = store.update.bind(store);
	store.set = (value: T) => {
		perfCount(`store.${name}.set`);
		const t = performance.now();
		originalSet(value);
		recordTiming(`store.${name}.fanout`, performance.now() - t);
	};
	store.update = (fn: (value: T) => T) => {
		perfCount(`store.${name}.set`);
		const t = performance.now();
		originalUpdate(fn);
		recordTiming(`store.${name}.fanout`, performance.now() - t);
	};
	return store;
}

/**
 * Registers the Konva module and stage so the monitor can count nodes and
 * time layer draws. Call after the stage and its layers are created.
 */
export function perfRegisterKonvaStage(konva: KonvaModule, stage: Konva.Stage): void {
	if (!perfEnabled) return;
	if (konvaStage !== stage) registeredLayerLabels.clear();
	konvaStage = stage;

	if (konvaModule !== konva) {
		konvaModule = konva;
		// Count destroys. Container.destroy calls super.destroy, so each node
		// is counted exactly once.
		const proto = konva.Node.prototype as unknown as { destroy: () => unknown };
		const originalDestroy = proto.destroy;
		proto.destroy = function (this: unknown) {
			konvaNodesDestroyed++;
			return originalDestroy.call(this);
		};
		konvaStartId = probeKonvaId();
		probesSinceStart = 0;
	}

	for (const layer of stage.getLayers()) {
		const label = layerLabel(layer);
		registeredLayerLabels.add(label);
		if (!counters.has(label)) counters.set(label, 0);
		// Registering again (same or new stage) must not add a second handler.
		if (hookedLayers.has(layer)) continue;
		hookedLayers.add(layer);
		layer.on('beforeDraw.perf', () => {
			layerDrawStart.set(layer, performance.now());
		});
		layer.on('draw.perf', () => {
			const start = layerDrawStart.get(layer);
			markRenderedFrame();
			perfCount(label);
			if (start !== undefined) recordTiming(label, performance.now() - start);
		});
	}
}

function layerLabel(layer: Konva.Layer): string {
	return `konva.draw.${layer.name() || `layer${layer.index}`}`;
}

/**
 * True while the registered stage is still in the document. Stage.destroy()
 * detaches its content element, while the host container may outlive it.
 */
function stageIsLive(): boolean {
	return konvaStage !== null && konvaStage.content?.isConnected === true;
}

/** Labels of layers currently on the registered stage that have no perf handlers. */
function unhookedLayerLabels(stage: Konva.Stage): string[] {
	return stage
		.getLayers()
		.filter((layer) => !hookedLayers.has(layer))
		.map(layerLabel);
}

/**
 * Konva gives every node a sequential `_id` from a global counter. Creating a
 * throwaway node and reading its id tells us how many nodes have been created
 * so far, without patching constructors.
 */
function probeKonvaId(): number | null {
	if (!konvaModule) return null;
	const probe = new konvaModule.Group() as unknown as { _id: number; destroy(): void };
	const id = probe._id;
	probesSinceStart++;
	konvaNodesDestroyed--; // the probe's own destroy is not app work
	probe.destroy();
	return id;
}

/**
 * Arms a one-shot rAF on the first layer draw since the last rendered frame.
 * Later draws before it fires (in other tasks or other rAF callbacks) belong
 * to the same display frame, so the count is at most one per display refresh.
 *
 * The frame is counted when the rAF fires, not at the draw: a draw inside a
 * rAF callback (Konva's batchDraw) cannot tell which frame it is in, and a
 * one-shot requested from it fires in the next frame. Konva's next draw
 * callback is queued after that one-shot, so in steady state each one-shot
 * sees exactly one frame's draws. Nothing is scheduled while nothing draws.
 */
function markRenderedFrame(): void {
	if (renderedFrameRafId !== null) return;
	renderedFrameRafId = requestAnimationFrame(countRenderedFrame);
}

function countRenderedFrame(ts: number): void {
	renderedFrameRafId = null;
	if (lastRenderedFrameTs !== null && renderedFrameIntervals.length < MAX_SAMPLES) {
		renderedFrameIntervals.push(ts - lastRenderedFrameTs);
	}
	lastRenderedFrameTs = ts;
	renderedFrameCount++;
}

function cancelRenderedFrame(): void {
	if (renderedFrameRafId !== null) cancelAnimationFrame(renderedFrameRafId);
	renderedFrameRafId = null;
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[idx] ?? 0;
}

function summarize(samples: number[]): TimingSummary {
	const sorted = [...samples].sort((a, b) => a - b);
	const total = sorted.reduce((a, b) => a + b, 0);
	return {
		count: sorted.length,
		totalMs: round(total),
		meanMs: round(sorted.length ? total / sorted.length : 0),
		p50Ms: round(percentile(sorted, 50)),
		p95Ms: round(percentile(sorted, 95)),
		p99Ms: round(percentile(sorted, 99)),
		maxMs: round(sorted[sorted.length - 1] ?? 0)
	};
}

function round(n: number): number {
	return Math.round(n * 1000) / 1000;
}

function frameTick(ts: number): void {
	if (lastFrameTs !== null && frameIntervals.length < MAX_SAMPLES) {
		frameIntervals.push(ts - lastFrameTs);
	}
	lastFrameTs = ts;
	frameRafId = requestAnimationFrame(frameTick);
}

function stopFrameSampling(): void {
	if (frameRafId !== null) cancelAnimationFrame(frameRafId);
	frameRafId = null;
	lastFrameTs = null;
}

function reset(options: ResetOptions = {}): void {
	windowStart = performance.now();
	timings = new Map();
	counters = new Map();
	// Explicit zeros only for a live stage; otherwise the draw counters stay
	// missing, so budgets fail rather than read a stale stage as idle.
	if (stageIsLive()) for (const label of registeredLayerLabels) counters.set(label, 0);
	frameIntervals = [];
	refreshIntervalMs =
		options.refreshIntervalMs && options.refreshIntervalMs > 0 ? options.refreshIntervalMs : null;
	renderedFrameCount = 0;
	renderedFrameIntervals = [];
	lastRenderedFrameTs = null;
	cancelRenderedFrame();
	konvaNodesDestroyed = 0;
	longTaskCount = 0;
	longTaskTotalMs = 0;
	konvaStartId = probeKonvaId();
	probesSinceStart = 0;
	stopFrameSampling();
	if (options.sampleFrames) {
		frameRafId = requestAnimationFrame(frameTick);
	}
}

function snapshot(): PerfSnapshot {
	const elapsedMs = performance.now() - windowStart;
	const elapsedSec = elapsedMs / 1000;

	const timingSummaries: Record<string, TimingSummary> = {};
	for (const [name, samples] of timings) timingSummaries[name] = summarize(samples);

	const counterObj: Record<string, number> = {};
	const rates: Record<string, number> = {};
	for (const [name, count] of counters) {
		counterObj[name] = count;
		rates[name] = round(elapsedSec > 0 ? count / elapsedSec : 0);
	}

	let frames: FrameSummary | null = null;
	if (frameIntervals.length > 0) {
		const s = summarize(frameIntervals);
		const periodMs = refreshIntervalMs ?? s.p50Ms;
		let droppedFrames = 0;
		let slowOver1_5x = 0;
		if (periodMs > 0) {
			for (const d of frameIntervals) {
				droppedFrames += Math.max(0, Math.round(d / periodMs) - 1);
				if (d > periodMs * 1.5) slowOver1_5x++;
			}
		}
		frames = {
			count: s.count,
			fps: round(s.count / elapsedSec),
			p50Ms: s.p50Ms,
			p95Ms: s.p95Ms,
			p99Ms: s.p99Ms,
			maxMs: s.maxMs,
			periodMs: round(periodMs),
			droppedFrames,
			slowOver1_5x
		};
	}

	const unhookedLayers = konvaStage ? unhookedLayerLabels(konvaStage) : null;
	const registered = stageIsLive() && unhookedLayers?.length === 0;

	let renderedFrames: RenderedFrameSummary | null = null;
	if (registered) {
		const r = renderedFrameIntervals.length > 0 ? summarize(renderedFrameIntervals) : null;
		renderedFrames = {
			count: renderedFrameCount,
			fps: round(elapsedSec > 0 ? renderedFrameCount / elapsedSec : 0),
			p50Ms: r ? r.p50Ms : null,
			p95Ms: r ? r.p95Ms : null,
			maxMs: r ? r.maxMs : null
		};
	}

	const startId = konvaStartId;
	const endId = probeKonvaId();
	// Exclude probe nodes created after the start probe (including this one).
	const nodesCreated =
		startId !== null && endId !== null ? endId - startId - probesSinceStart : null;

	const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;

	return {
		elapsedMs: round(elapsedMs),
		timings: timingSummaries,
		counters: counterObj,
		ratesPerSec: rates,
		frames,
		renderedFrames,
		konva: {
			registered,
			layers: konvaStage ? [...registeredLayerLabels] : null,
			unhookedLayers,
			nodesCreated,
			nodesDestroyed: konvaNodesDestroyed,
			nodeCount: konvaStage ? konvaStage.find(() => true).length : null,
			layerCount: konvaStage ? konvaStage.getLayers().length : null
		},
		heapUsedBytes: memory ? memory.usedJSHeapSize : null,
		longTasks: longTasksSupported
			? { count: longTaskCount, totalMs: round(longTaskTotalMs) }
			: null,
		devicePixelRatio: window.devicePixelRatio,
		userAgent: navigator.userAgent
	};
}

let longTasksSupported = false;

function init(): void {
	if (!perfEnabled || window.__perf) return;
	try {
		if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					longTaskCount++;
					longTaskTotalMs += entry.duration;
				}
			}).observe({ type: 'longtask', buffered: false });
			longTasksSupported = true;
		}
	} catch {
		longTasksSupported = false;
	}
	windowStart = performance.now();
	window.__perf = { enabled: true, reset, snapshot };
	console.info('[perf] instrumentation enabled; use window.__perf.reset()/snapshot()');
}

init();
