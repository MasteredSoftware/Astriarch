/**
 * Perf result model: flattening a window run into named metrics, summarizing
 * repetitions, and writing perf-results/<sha>[-dirty]-<browser>.json.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CpuDelta } from './cpuSampler';
import type { PerfSnapshot } from '../../src/lib/perf/perfMonitor';

export type WindowName = 'idle' | 'panzoom' | 'fleets';

export interface WindowRun {
	repetition: number;
	cpu: CpuDelta;
	perf: PerfSnapshot;
	/** Chromium only: deltas of Performance.getMetrics durations, in seconds. */
	cdp: Record<string, number> | null;
	/** Problems that make this run less trustworthy (e.g. rAF throttled). */
	warnings: string[];
	metrics: Record<string, number>;
}

export interface MetricSummary {
	median: number;
	min: number;
	max: number;
	n: number;
}

export interface PerfResultFile {
	schemaVersion: 1;
	meta: {
		label: string | null;
		gitSha: string;
		gitDirty: boolean;
		gitBranch: string;
		date: string;
		browser: string;
		browserVersion: string;
		platform: string;
		osRelease: string;
		cpuModel: string;
		cpuCount: number;
		viewport: { width: number; height: number };
		windowMs: number;
		warmupMs: number;
		repetitions: number;
		galaxySeed: number;
	};
	windows: Partial<
		Record<WindowName, { runs: WindowRun[]; summary: Record<string, MetricSummary> }>
	>;
}

const round = (n: number, digits = 3) => {
	const f = 10 ** digits;
	return Math.round(n * f) / f;
};

/**
 * Flattens one window run into `name -> number`. Naming:
 *   cpu.*        % of one core (lower is better)
 *   rate.*       events per second
 *   time.*       ms; `.msPerSec` = ms of that work per wall second (load)
 *   frames.*     frame-interval stats (fps: higher is better)
 *   konva.*      node churn and node count (`konva.registered` is 1 when instrumented)
 *   cdp.*Pct     Chromium: % of wall time spent in script/layout/etc.
 */
export function flattenMetrics(
	cpu: CpuDelta,
	perf: PerfSnapshot,
	cdp: Record<string, number> | null
): Record<string, number> {
	const m: Record<string, number> = {};
	const elapsedSec = perf.elapsedMs / 1000;

	m['cpu.totalPct'] = cpu.totalPct;
	for (const [role, pct] of Object.entries(cpu.byRolePct)) m[`cpu.${role}Pct`] = pct;

	for (const [name, rate] of Object.entries(perf.ratesPerSec)) m[`rate.${name}`] = rate;

	for (const [name, t] of Object.entries(perf.timings)) {
		m[`time.${name}.meanMs`] = t.meanMs;
		m[`time.${name}.p95Ms`] = t.p95Ms;
		m[`time.${name}.maxMs`] = t.maxMs;
		m[`time.${name}.msPerSec`] = round(elapsedSec > 0 ? t.totalMs / elapsedSec : 0);
	}

	if (perf.frames) {
		m['frames.fps'] = perf.frames.fps;
		m['frames.p50Ms'] = perf.frames.p50Ms;
		m['frames.p95Ms'] = perf.frames.p95Ms;
		m['frames.p99Ms'] = perf.frames.p99Ms;
		m['frames.over16_7Pct'] = round((perf.frames.over16_7ms / perf.frames.count) * 100, 2);
		m['frames.over33_3Pct'] = round((perf.frames.over33_3ms / perf.frames.count) * 100, 2);
	}

	// Without a registered stage the Konva counters are not instrumented, so
	// leave them out rather than report a misleading 0 (budgets then say MISSING).
	m['konva.registered'] = perf.konva.registered ? 1 : 0;
	if (perf.konva.nodesCreated !== null) {
		m['konva.nodesCreatedPerSec'] = round(perf.konva.nodesCreated / elapsedSec);
	}
	if (perf.konva.registered) {
		m['konva.nodesDestroyedPerSec'] = round(perf.konva.nodesDestroyed / elapsedSec);
	}
	if (perf.konva.nodeCount !== null) m['konva.nodeCount'] = perf.konva.nodeCount;

	if (perf.heapUsedBytes !== null) m['heap.usedMB'] = round(perf.heapUsedBytes / 1024 / 1024, 1);
	if (perf.longTasks) {
		m['longTasks.perSec'] = round(perf.longTasks.count / elapsedSec);
		m['longTasks.msPerSec'] = round(perf.longTasks.totalMs / elapsedSec);
	}

	if (cdp) {
		for (const [name, value] of Object.entries(cdp)) {
			if (name.endsWith('Duration')) m[`cdp.${name}Pct`] = round((value / cpu.wallSec) * 100, 2);
			else if (name === 'JSHeapUsedSize') m['cdp.JSHeapUsedMB'] = round(value / 1024 / 1024, 1);
		}
	}
	return m;
}

export function summarizeRuns(runs: WindowRun[]): Record<string, MetricSummary> {
	const names = new Set(runs.flatMap((r) => Object.keys(r.metrics)));
	const summary: Record<string, MetricSummary> = {};
	for (const name of [...names].sort()) {
		const values = runs
			.map((r) => r.metrics[name])
			.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
			.sort((a, b) => a - b);
		if (values.length === 0) continue;
		const mid = Math.floor(values.length / 2);
		const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
		summary[name] = {
			median: round(median),
			min: values[0],
			max: values[values.length - 1],
			n: values.length
		};
	}
	return summary;
}

function git(args: string[]): string {
	try {
		return execFileSync('git', args, { encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
}

export function gitInfo() {
	const status = git(['status', '--porcelain', '--untracked-files=no']);
	return {
		gitSha: git(['rev-parse', '--short', 'HEAD']),
		gitDirty: status !== '' && status !== 'unknown',
		gitBranch: git(['rev-parse', '--abbrev-ref', 'HEAD'])
	};
}

export function machineInfo() {
	const cpus = os.cpus();
	return {
		platform: `${process.platform}-${process.arch}`,
		osRelease: os.release(),
		cpuModel: cpus[0]?.model ?? 'unknown',
		cpuCount: cpus.length
	};
}

export const RESULTS_DIR = path.resolve(import.meta.dirname, '../../perf-results');

export function resultFileName(meta: PerfResultFile['meta']): string {
	const parts = [meta.label ?? meta.gitSha];
	if (!meta.label && meta.gitDirty) parts.push('dirty');
	parts.push(meta.browser);
	return `${parts.join('-').replace(/[^\w.-]+/g, '_')}.json`;
}

export function writeResults(result: PerfResultFile): string {
	mkdirSync(RESULTS_DIR, { recursive: true });
	const file = path.join(RESULTS_DIR, resultFileName(result.meta));
	writeFileSync(file, JSON.stringify(result, null, '\t') + '\n');
	return file;
}
