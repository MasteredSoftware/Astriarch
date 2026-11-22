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

/**
 * A short harness-side rAF probe taken just before a window is measured
 * (outside the measured interval). It does not depend on app behaviour, so it
 * detects throttling and the display refresh rate the same way before and
 * after event-driven rendering lands.
 */
export interface EnvProbe {
	durationMs: number;
	/** rAF callbacks during the probe. */
	frames: number;
	rafPerSec: number;
	medianIntervalMs: number | null;
	/** 1000 / medianIntervalMs: the cadence rAF ran at. */
	refreshHz: number | null;
	visibilityState: string;
	hasFocus: boolean;
	devicePixelRatio: number;
}

export interface WindowEnv {
	/** Probe taken before the window started. */
	start: EnvProbe;
	/** Visibility and focus right after the window's action finished. */
	end: { visibilityState: string; hasFocus: boolean };
}

export interface WindowRun {
	repetition: number;
	cpu: CpuDelta;
	perf: PerfSnapshot;
	/** Chromium only: deltas of Performance.getMetrics durations, in seconds. */
	cdp: Record<string, number> | null;
	env: WindowEnv;
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
	/**
	 * 2: adds meta.refreshHz/devicePixelRatio, per-run env, rendered.* and
	 * frames.dropped* metrics; removes frames.over16_7Pct/over33_3Pct.
	 * 3: rendered.* counts display frames with a draw (one-shot rAF), not draw
	 * tasks, so v2 rendered.* values are not comparable.
	 */
	schemaVersion: 3;
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
		/** Measured by the first window's probe in repetition 1. */
		refreshHz: number | null;
		devicePixelRatio: number | null;
	};
	windows: Partial<
		Record<WindowName, { runs: WindowRun[]; summary: Record<string, MetricSummary> }>
	>;
}

const round = (n: number, digits = 3) => {
	const f = 10 ** digits;
	return Math.round(n * f) / f;
};

/** Below this probe rate the browser is almost certainly throttling the page. */
const MIN_RAF_PER_SEC = 20;
/** Refresh rates further apart than this are treated as a different display mode. */
export const REFRESH_TOLERANCE = 0.1;

/**
 * Warnings derived from a window's environment probe. `referenceHz` is the
 * refresh rate recorded in meta (null for the very first probe).
 */
export function environmentWarnings(env: WindowEnv, referenceHz: number | null): string[] {
	const warnings: string[] = [];
	const { start, end } = env;
	if (
		start.rafPerSec < MIN_RAF_PER_SEC ||
		(referenceHz !== null && start.rafPerSec < referenceHz / 2)
	) {
		warnings.push(
			`rAF probe ran at ${start.rafPerSec}/s before the window: the browser may be throttling the page`
		);
	}
	if (start.visibilityState !== 'visible' || end.visibilityState !== 'visible') {
		warnings.push(
			`page was not visible (start: ${start.visibilityState}, end: ${end.visibilityState})`
		);
	}
	if (!start.hasFocus || !end.hasFocus) {
		warnings.push(
			`browser window lost focus (start: ${start.hasFocus}, end: ${end.hasFocus}); it may be occluded`
		);
	}
	if (
		referenceHz !== null &&
		start.refreshHz !== null &&
		Math.abs(start.refreshHz - referenceHz) > referenceHz * REFRESH_TOLERANCE
	) {
		warnings.push(
			`refresh rate ${start.refreshHz}Hz differs from the ${referenceHz}Hz recorded for this run`
		);
	}
	return warnings;
}

/**
 * Flattens one window run into `name -> number`. Naming:
 *   cpu.*        % of one core (lower is better)
 *   rate.*       events per second
 *   time.*       ms; `.msPerSec` = ms of that work per wall second (load)
 *   frames.*     rAF frame-interval stats while the sampler runs (fps: higher is
 *                better); droppedPct/slowOver1_5xPct are relative to the
 *                measured refresh interval
 *   rendered.*   display frames in which a Konva layer drew (every window, incl.
 *                idle); at most the display refresh rate
 *   konva.*      node churn and node count (`konva.registered` is 1 when the stage
 *                is live and every layer is hooked; `konva.unhookedLayers` counts
 *                layers added after registration)
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

	for (const [name, rate] of Object.entries(perf.ratesPerSec)) {
		// Layer draw counters of an unregistered (stale or partly hooked) stage
		// are not trustworthy; leave them out so budgets say MISSING.
		if (!perf.konva.registered && name.startsWith('konva.draw.')) continue;
		m[`rate.${name}`] = rate;
	}

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
		m['frames.periodMs'] = perf.frames.periodMs;
		// Share of display refreshes in the window that got no frame.
		const refreshes = perf.frames.count + perf.frames.droppedFrames;
		m['frames.droppedPct'] = round((perf.frames.droppedFrames / refreshes) * 100, 2);
		m['frames.slowOver1_5xPct'] = round((perf.frames.slowOver1_5x / perf.frames.count) * 100, 2);
	}

	if (perf.renderedFrames) {
		m['rendered.fps'] = perf.renderedFrames.fps;
		if (perf.renderedFrames.p50Ms !== null) m['rendered.p50Ms'] = perf.renderedFrames.p50Ms;
		if (perf.renderedFrames.p95Ms !== null) m['rendered.p95Ms'] = perf.renderedFrames.p95Ms;
		if (perf.renderedFrames.maxMs !== null) m['rendered.maxMs'] = perf.renderedFrames.maxMs;
	}

	// Without a registered stage (never registered, detached, or with unhooked
	// layers) the Konva counters are not trustworthy, so leave them out rather
	// than report a misleading 0 (budgets then say MISSING).
	m['konva.registered'] = perf.konva.registered ? 1 : 0;
	if (perf.konva.unhookedLayers) m['konva.unhookedLayers'] = perf.konva.unhookedLayers.length;
	if (perf.konva.registered && perf.konva.nodesCreated !== null) {
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
