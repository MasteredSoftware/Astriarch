import { describe, it, expect } from 'vitest';
import {
	flattenMetrics,
	summarizeRuns,
	resultFileName,
	type PerfResultFile,
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
		ratesPerSec: { 'raf.canvas': 60 },
		frames: null,
		konva: {
			registered: true,
			layers: ['konva.draw.galaxy'],
			nodesCreated: 10,
			nodesDestroyed: 4,
			nodeCount: 500,
			layerCount: 3
		},
		heapUsedBytes: 10 * 1024 * 1024,
		longTasks: { count: 2, totalMs: 120 },
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
		expect(m['konva.nodesCreatedPerSec']).toBe(5);
		expect(m['konva.nodesDestroyedPerSec']).toBe(2);
		expect(m['konva.nodeCount']).toBe(500);
		expect(m['heap.usedMB']).toBe(10);
		expect(m['longTasks.perSec']).toBe(1);
		expect(m['longTasks.msPerSec']).toBe(60);
		expect(Object.keys(m).some((k) => k.startsWith('frames.'))).toBe(false);
	});

	it('omits Konva churn when no stage is registered', () => {
		const m = flattenMetrics(
			cpu,
			snapshot({
				konva: {
					registered: false,
					layers: null,
					nodesCreated: null,
					nodesDestroyed: 0,
					nodeCount: null,
					layerCount: null
				}
			}),
			null
		);
		expect(m['konva.registered']).toBe(0);
		expect(m['konva.nodesCreatedPerSec']).toBeUndefined();
		expect(m['konva.nodesDestroyedPerSec']).toBeUndefined();
		expect(m['konva.nodeCount']).toBeUndefined();
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

function run(metrics: Record<string, number>): WindowRun {
	return {
		repetition: 1,
		cpu,
		perf: snapshot(),
		cdp: null,
		warnings: [],
		metrics
	};
}

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
