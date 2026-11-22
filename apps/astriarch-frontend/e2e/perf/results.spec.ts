import { describe, it, expect } from 'vitest';
import {
	environmentWarnings,
	flattenMetrics,
	isCleanProbe,
	parseWindowFilter,
	summarizeRuns,
	resultFileName,
	tickRateWarning,
	type EnvProbe,
	type PerfResultFile,
	type WindowEnv,
	type WindowRun
} from './results';
import type { CpuDelta } from './cpuSampler';
import type { PerfSnapshot } from '../../src/lib/perf/perfMonitor';

const cpu: CpuDelta = {
	wallSec: 2,
	cpuSec: 1,
	totalPct: 50,
	byRolePct: { renderer: 40, gpu: 10 },
	processCount: 3,
	exitedProcesses: 0
};

function snapshot(overrides: Partial<PerfSnapshot> = {}): PerfSnapshot {
	return {
		elapsedMs: 2000,
		timings: {
			'canvas.update': {
				count: 4,
				totalMs: 10,
				meanMs: 2.5,
				p50Ms: 2,
				p95Ms: 4,
				p99Ms: 4,
				maxMs: 4
			}
		},
		counters: { 'raf.canvas': 120 },
		ratesPerSec: { 'raf.canvas': 60, 'konva.draw.galaxy': 60 },
		frames: null,
		renderedFrames: { count: 10, fps: 5, p50Ms: 200, p95Ms: 210, maxMs: 250 },
		konva: {
			registered: true,
			layers: ['konva.draw.galaxy'],
			unhookedLayers: [],
			nodesCreated: 10,
			nodesDestroyed: 4,
			nodeCount: 500,
			layerCount: 3
		},
		heapUsedBytes: 10 * 1024 * 1024,
		longTasks: { count: 2, totalMs: 120 },
		runningAnimations: [],
		loopingAnimations: [],
		devicePixelRatio: 2,
		userAgent: 'test',
		...overrides
	};
}

describe('flattenMetrics', () => {
	it('flattens cpu, rates, timings, konva, heap and long tasks', () => {
		const m = flattenMetrics(cpu, snapshot(), null);
		expect(m['cpu.totalPct']).toBe(50);
		expect(m['cpu.rendererPct']).toBe(40);
		expect(m['cpu.gpuPct']).toBe(10);
		expect(m['rate.raf.canvas']).toBe(60);
		expect(m['time.canvas.update.meanMs']).toBe(2.5);
		expect(m['time.canvas.update.msPerSec']).toBe(5);
		expect(m['konva.registered']).toBe(1);
		expect(m['konva.unhookedLayers']).toBe(0);
		expect(m['rate.konva.draw.galaxy']).toBe(60);
		expect(m['konva.nodesCreatedPerSec']).toBe(5);
		expect(m['konva.nodesDestroyedPerSec']).toBe(2);
		expect(m['konva.nodeCount']).toBe(500);
		expect(m['heap.usedMB']).toBe(10);
		expect(m['longTasks.perSec']).toBe(1);
		expect(m['longTasks.msPerSec']).toBe(60);
		expect(m['rendered.fps']).toBe(5);
		expect(m['rendered.p95Ms']).toBe(210);
		expect(Object.keys(m).some((k) => k.startsWith('frames.'))).toBe(false);
	});

	it('flattens frame stats with dropped frames relative to the period', () => {
		const m = flattenMetrics(
			cpu,
			snapshot({
				frames: {
					count: 90,
					fps: 45,
					p50Ms: 16.7,
					p95Ms: 33.4,
					p99Ms: 50,
					maxMs: 60,
					periodMs: 16.667,
					droppedFrames: 10,
					slowOver1_5x: 9
				}
			}),
			null
		);
		expect(m['frames.fps']).toBe(45);
		expect(m['frames.periodMs']).toBe(16.667);
		expect(m['frames.droppedPct']).toBe(10);
		expect(m['frames.slowOver1_5xPct']).toBe(10);
		expect(m['frames.over16_7Pct']).toBeUndefined();
	});

	it('omits rendered-frame interval stats with fewer than two frames', () => {
		const m = flattenMetrics(
			cpu,
			snapshot({
				renderedFrames: { count: 0, fps: 0, p50Ms: null, p95Ms: null, maxMs: null }
			}),
			null
		);
		expect(m['rendered.fps']).toBe(0);
		expect(m['rendered.p50Ms']).toBeUndefined();
	});

	it('budgets only looping animations as dom.runningAnimations', () => {
		const m = flattenMetrics(
			cpu,
			snapshot({
				runningAnimations: ['CSSAnimation dots on div.dot', 'CSSTransition opacity on div.card'],
				loopingAnimations: ['CSSAnimation dots on div.dot']
			}),
			null
		);
		expect(m['dom.runningAnimations']).toBe(1);
		expect(flattenMetrics(cpu, snapshot(), null)['dom.runningAnimations']).toBe(0);
	});

	it('omits dom.runningAnimations when getAnimations is unsupported or the file predates it', () => {
		const unsupported = snapshot({ runningAnimations: null, loopingAnimations: null });
		expect(flattenMetrics(cpu, unsupported, null)['dom.runningAnimations']).toBeUndefined();

		const older = snapshot({ runningAnimations: ['CSSAnimation dots on div.dot'] });
		delete (older as Partial<PerfSnapshot>).loopingAnimations;
		expect(flattenMetrics(cpu, older, null)['dom.runningAnimations']).toBeUndefined();
	});

	it('omits Konva churn when no stage is registered', () => {
		const m = flattenMetrics(
			cpu,
			snapshot({
				konva: {
					registered: false,
					layers: null,
					unhookedLayers: null,
					nodesCreated: null,
					nodesDestroyed: 0,
					nodeCount: null,
					layerCount: null
				},
				renderedFrames: null
			}),
			null
		);
		expect(m['konva.registered']).toBe(0);
		expect(m['konva.nodesCreatedPerSec']).toBeUndefined();
		expect(m['konva.nodesDestroyedPerSec']).toBeUndefined();
		expect(m['konva.nodeCount']).toBeUndefined();
		expect(m['konva.unhookedLayers']).toBeUndefined();
		expect(m['rendered.fps']).toBeUndefined();
	});

	it('omits layer draws and node churn for a stale or partly hooked stage', () => {
		const m = flattenMetrics(
			cpu,
			snapshot({
				konva: {
					registered: false,
					layers: ['konva.draw.galaxy'],
					unhookedLayers: ['konva.draw.ui'],
					nodesCreated: 10,
					nodesDestroyed: 4,
					nodeCount: 500,
					layerCount: 2
				},
				renderedFrames: null
			}),
			null
		);
		expect(m['konva.registered']).toBe(0);
		expect(m['konva.unhookedLayers']).toBe(1);
		expect(m['rate.konva.draw.galaxy']).toBeUndefined();
		expect(m['rate.raf.canvas']).toBe(60);
		expect(m['konva.nodesCreatedPerSec']).toBeUndefined();
		expect(m['konva.nodesDestroyedPerSec']).toBeUndefined();
		expect(m['rendered.fps']).toBeUndefined();
	});

	it('converts CDP durations to % of wall time', () => {
		const m = flattenMetrics(cpu, snapshot(), {
			ScriptDuration: 0.5,
			JSHeapUsedSize: 20 * 1024 * 1024
		});
		expect(m['cdp.ScriptDurationPct']).toBe(25);
		expect(m['cdp.JSHeapUsedMB']).toBe(20);
	});
});

const probe: EnvProbe = {
	durationMs: 500,
	frames: 60,
	rafPerSec: 120,
	medianIntervalMs: 8.333,
	refreshHz: 120,
	visibilityState: 'visible',
	hasFocus: true,
	devicePixelRatio: 2
};
const env: WindowEnv = { start: probe, end: probe };

describe('environmentWarnings', () => {
	it('is quiet for a visible page at the reference rate', () => {
		expect(environmentWarnings(env, null)).toEqual([]);
		expect(environmentWarnings(env, 120)).toEqual([]);
	});

	it('warns when the probe rate is below 20/s', () => {
		const w = environmentWarnings({ ...env, start: { ...probe, rafPerSec: 4 } }, null);
		expect(w).toHaveLength(1);
		expect(w[0]).toMatch(/4\/s before the window: .*throttling/);
	});

	it('warns when the probe rate is below half the reference rate', () => {
		const w = environmentWarnings({ ...env, start: { ...probe, rafPerSec: 50 } }, 120);
		expect(w.some((x) => /throttling/.test(x))).toBe(true);
	});

	it('warns when the probe after the window is throttled', () => {
		const w = environmentWarnings({ ...env, end: { ...probe, rafPerSec: 1 } }, 120);
		expect(w).toEqual([
			'rAF probe ran at 1/s after the window: the browser may be throttling the page'
		]);
	});

	it('warns when the page is hidden at start or end', () => {
		const w = environmentWarnings(
			{ start: probe, end: { ...probe, visibilityState: 'hidden' } },
			null
		);
		expect(w).toEqual(['page was not visible (start: visible, end: hidden)']);
	});

	it('does not warn about focus, which Playwright emulates', () => {
		const unfocused = { ...probe, hasFocus: false };
		expect(environmentWarnings({ start: unfocused, end: unfocused }, 120)).toEqual([]);
	});

	it('warns when the refresh rate differs from the reference by more than 10%', () => {
		expect(environmentWarnings({ ...env, start: { ...probe, refreshHz: 110 } }, 120)).toEqual([]);
		const w = environmentWarnings(
			{
				start: { ...probe, refreshHz: 60, rafPerSec: 60 },
				end: { ...probe, refreshHz: 60, rafPerSec: 60 }
			},
			120
		);
		expect(w).toEqual([
			'refresh rate 60Hz before the window differs from the 120Hz recorded for this run',
			'refresh rate 60Hz after the window differs from the 120Hz recorded for this run'
		]);
	});
});

describe('isCleanProbe', () => {
	it('accepts a visible probe that ran at its own cadence', () => {
		expect(isCleanProbe(probe)).toBe(true);
		expect(isCleanProbe({ ...probe, rafPerSec: 110 })).toBe(true);
	});

	it('rejects a hidden probe', () => {
		expect(isCleanProbe({ ...probe, visibilityState: 'hidden' })).toBe(false);
	});

	it('rejects a probe below 20 rAF/s or without a median', () => {
		expect(isCleanProbe({ ...probe, rafPerSec: 10, refreshHz: 10, medianIntervalMs: 100 })).toBe(
			false
		);
		expect(isCleanProbe({ ...probe, refreshHz: null, medianIntervalMs: null })).toBe(false);
	});

	it('rejects a probe that stalled part of the time', () => {
		// Median says 120Hz, but only 60 callbacks per second ran: throttled for part of it.
		expect(isCleanProbe({ ...probe, rafPerSec: 60 })).toBe(false);
	});

	it('ignores focus', () => {
		expect(isCleanProbe({ ...probe, hasFocus: false })).toBe(true);
	});
});

function run(metrics: Record<string, number>): WindowRun {
	return {
		repetition: 1,
		cpu,
		perf: snapshot(),
		cdp: null,
		env,
		warnings: [],
		metrics
	};
}

describe('parseWindowFilter', () => {
	it('selects every window when unset or empty', () => {
		const all = ['idle', 'panzoom', 'fleets', 'build'];
		expect([...parseWindowFilter(undefined)]).toEqual(all);
		expect([...parseWindowFilter('')]).toEqual(all);
		expect([...parseWindowFilter(' , ')]).toEqual(all);
	});

	it('selects the listed windows', () => {
		expect([...parseWindowFilter('build')]).toEqual(['build']);
		expect([...parseWindowFilter(' idle, build ')]).toEqual(['idle', 'build']);
	});

	it('rejects an unknown window', () => {
		expect(() => parseWindowFilter('idle,bild')).toThrow(/unknown window\(s\) bild/);
	});
});

describe('tickRateWarning', () => {
	it('warns that the loop did not tick when the counter is absent or 0', () => {
		expect(tickRateWarning(undefined)).toMatch(/did not tick/);
		expect(tickRateWarning(0)).toMatch(/did not tick/);
	});

	it('warns about throttling below 4/s', () => {
		expect(tickRateWarning(3)).toMatch(/ticked 3\/s .*throttling/);
		expect(tickRateWarning(3.99)).not.toBeNull();
	});

	it('does not warn at the expected rate', () => {
		expect(tickRateWarning(4)).toBeNull();
		expect(tickRateWarning(5)).toBeNull();
	});
});

describe('summarizeRuns', () => {
	it('takes the middle value of an odd number of runs', () => {
		const s = summarizeRuns([run({ a: 3 }), run({ a: 1 }), run({ a: 2 })]);
		expect(s.a).toEqual({ median: 2, min: 1, max: 3, n: 3 });
	});

	it('averages the middle two values of an even number of runs', () => {
		const s = summarizeRuns([run({ a: 4 }), run({ a: 1 }), run({ a: 2 }), run({ a: 10 })]);
		expect(s.a).toEqual({ median: 3, min: 1, max: 10, n: 4 });
	});

	it('drops non-finite values and metrics missing from some runs', () => {
		const s = summarizeRuns([run({ a: NaN, b: 1 }), run({ a: Infinity }), run({ b: 3 })]);
		expect(s.a).toBeUndefined();
		expect(s.b).toEqual({ median: 2, min: 1, max: 3, n: 2 });
	});
});

describe('resultFileName', () => {
	const meta = {
		label: null,
		gitSha: 'abc1234',
		gitDirty: false,
		browser: 'chromium'
	} as unknown as PerfResultFile['meta'];

	it('uses the sha and browser', () => {
		expect(resultFileName(meta)).toBe('abc1234-chromium.json');
	});

	it('marks a dirty tree', () => {
		expect(resultFileName({ ...meta, gitDirty: true })).toBe('abc1234-dirty-chromium.json');
	});

	it('prefers the label, ignores dirtiness, and sanitizes it', () => {
		expect(resultFileName({ ...meta, gitDirty: true, label: 'fix fleets/v2' })).toBe(
			'fix_fleets_v2-chromium.json'
		);
	});
});
