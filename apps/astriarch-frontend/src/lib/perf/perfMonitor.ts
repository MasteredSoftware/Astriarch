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
 *   - frames:   rAF frame-interval distribution (only while sampleFrames is on;
 *               the sampler is its own rAF loop, so it is off by default to keep
 *               idle measurements honest)
 *   - konva:    nodes created/destroyed, current node count, per-layer draws
 *   - heap / longTasks: where the browser supports them (Chromium)
 *   - running CSS/Web animations when the snapshot is taken (an infinite one
 *     makes the browser composite every frame even when nothing else changes)
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
	over16_7ms: number;
	over33_3ms: number;
}

export interface PerfSnapshot {
	elapsedMs: number;
	timings: Record<string, TimingSummary>;
	counters: Record<string, number>;
	ratesPerSec: Record<string, number>;
	frames: FrameSummary | null;
	konva: {
		nodesCreated: number | null;
		nodesDestroyed: number;
		nodeCount: number | null;
		layerCount: number | null;
	};
	heapUsedBytes: number | null;
	longTasks: { count: number; totalMs: number } | null;
	/** CSS/Web animations running at snapshot time, e.g. "CSSAnimation scan on div.scan-line" */
	runningAnimations: string[];
	devicePixelRatio: number;
	userAgent: string;
}

export interface ResetOptions {
	/** Run a rAF loop to record frame intervals during this window. */
	sampleFrames?: boolean;
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
let konvaNodesDestroyed = 0;
let longTaskCount = 0;
let longTaskTotalMs = 0;

let konvaModule: KonvaModule | null = null;
let konvaStage: Konva.Stage | null = null;
let konvaStartId: number | null = null;
/** Probe nodes created since konvaStartId was taken (they are not app work). */
let probesSinceStart = 0;
const layerDrawStart = new WeakMap<object, number>();

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
		const label = `konva.draw.${layer.name() || `layer${layer.index}`}`;
		layer.on('beforeDraw.perf', () => {
			layerDrawStart.set(layer, performance.now());
		});
		layer.on('draw.perf', () => {
			const start = layerDrawStart.get(layer);
			perfCount(label);
			if (start !== undefined) recordTiming(label, performance.now() - start);
		});
	}
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
	frameIntervals = [];
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
		frames = {
			count: s.count,
			fps: round(s.count / elapsedSec),
			p50Ms: s.p50Ms,
			p95Ms: s.p95Ms,
			p99Ms: s.p99Ms,
			maxMs: s.maxMs,
			over16_7ms: frameIntervals.filter((d) => d > 16.7).length,
			over33_3ms: frameIntervals.filter((d) => d > 33.3).length
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
		konva: {
			nodesCreated,
			nodesDestroyed: konvaNodesDestroyed,
			nodeCount: konvaStage ? konvaStage.find(() => true).length : null,
			layerCount: konvaStage ? konvaStage.getLayers().length : null
		},
		heapUsedBytes: memory ? memory.usedJSHeapSize : null,
		longTasks: longTasksSupported
			? { count: longTaskCount, totalMs: round(longTaskTotalMs) }
			: null,
		runningAnimations: describeRunningAnimations(),
		devicePixelRatio: window.devicePixelRatio,
		userAgent: navigator.userAgent
	};
}

let longTasksSupported = false;

function describeRunningAnimations(): string[] {
	if (typeof document === 'undefined' || typeof document.getAnimations !== 'function') return [];
	return document
		.getAnimations()
		.filter((a) => a.playState === 'running')
		.map((a) => {
			const name =
				(a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id;
			const target = (a.effect as KeyframeEffect | null)?.target;
			const cls = target ? String(target.getAttribute('class') ?? '').split(' ')[0] : '';
			return `${a.constructor.name} ${name} on ${target?.tagName.toLowerCase() ?? '?'}${cls ? '.' + cls : ''}`;
		});
}

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
