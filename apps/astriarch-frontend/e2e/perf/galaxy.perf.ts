/**
 * Galaxy performance benchmark. Run via `pnpm --filter astriarch-frontend perf`
 * (see e2e/perf/README.md). Not part of the normal e2e suite.
 *
 * Each repetition launches a fresh browser, starts the pinned benchmark game,
 * warms up, then measures three windows. Before and after each window (outside
 * the measured interval) a 500ms rAF probe records the rAF rate, refresh rate
 * and visibility, so throttling on either side is detected without relying on
 * app counters. Focus is recorded but not checked: Playwright emulates focus,
 * and a visible unfocused window is not throttled. The refresh rate recorded in
 * meta comes only from a probe that passes the throttle checks.
 * The windows:
 *   idle     no input (frame sampler off, so the harness adds no rAF loop)
 *   panzoom  scripted drags and wheel zooms (frame sampler on)
 *   fleets   after sending a fleet, no input while it is in transit (frame sampler on)
 *
 * Results are written to perf-results/<sha>[-dirty]-<browser>.json after every
 * repetition, so a partial run still leaves data behind.
 */

import { test, type Browser, type BrowserServer, type Page } from '@playwright/test';
import { cleanupTestData } from '../helpers/cleanup';
import { sampleTree, cpuDelta } from './cpuSampler';
import {
	flattenMetrics,
	summarizeRuns,
	writeResults,
	gitInfo,
	machineInfo,
	environmentWarnings,
	isCleanProbe,
	type EnvProbe,
	type PerfResultFile,
	type WindowName,
	type WindowRun
} from './results';
import { checkBudgets } from './budgets';
import {
	startBenchmarkGame,
	panAndZoom,
	sendFleet,
	setGalaxySeed,
	BENCHMARK_GAME,
	PAGE_HELPERS_SCRIPT
} from './perfScenario';
import type { PerfSnapshot } from '../../src/lib/perf/perfMonitor';

const REPETITIONS = Number(process.env.PERF_REPEATS ?? 5);
const WINDOW_MS = Number(process.env.PERF_WINDOW_MS ?? 20_000);
const WARMUP_MS = Number(process.env.PERF_WARMUP_MS ?? 10_000);
const SETTLE_MS = 2_000;
const PROBE_MS = 500;
const VIEWPORT = { width: 1440, height: 900 };
const ENFORCE_BUDGETS = process.env.PERF_ENFORCE_BUDGETS === '1';

/** Keep a headed browser from throttling rAF/timers when its window is covered. */
const CHROMIUM_ARGS = [
	'--disable-backgrounding-occluded-windows',
	'--disable-renderer-backgrounding',
	'--disable-background-timer-throttling'
];
const FIREFOX_PREFS = {
	'widget.windows.window_occlusion_tracking.enabled': false,
	'dom.timeout.enable_budget_timer_throttling': false,
	// Firefox clamps performance.now() to 1ms by default, which would round the
	// sub-millisecond timings recorded by perfMonitor down to 0.
	'privacy.reduceTimerPrecision': false
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(WARMUP_MS + WINDOW_MS * 3 + 180_000);

let result: PerfResultFile | null = null;
const runs: Record<WindowName, WindowRun[]> = { idle: [], panzoom: [], fleets: [] };

test.beforeAll(async () => {
	await cleanupTestData();
});

test.afterAll(async () => {
	await setGalaxySeed(null).catch(() => {});
	await cleanupTestData();
	if (!result) return;
	printSummary(result);
});

for (let rep = 1; rep <= REPETITIONS; rep++) {
	test(`repetition ${rep}/${REPETITIONS}`, async ({ playwright, browserName }) => {
		const browserType = playwright[browserName];
		const headless = process.env.PERF_HEADLESS === '1';
		const server: BrowserServer = await browserType.launchServer({
			headless,
			args: browserName === 'chromium' ? CHROMIUM_ARGS : undefined,
			firefoxUserPrefs: browserName === 'firefox' ? FIREFOX_PREFS : undefined
		});
		const browserPid = server.process().pid;
		if (!browserPid) throw new Error('Could not determine browser process id');

		let browser: Browser | null = null;
		try {
			browser = await browserType.connect(server.wsEndpoint());
			const context = await browser.newContext({
				viewport: VIEWPORT,
				baseURL: test.info().project.use.baseURL
			});
			await context.addInitScript(`window.__ASTRIARCH_PERF__ = true;\n${PAGE_HELPERS_SCRIPT}`);
			const page = await context.newPage();

			const homePlanetId = await startBenchmarkGame(page);
			await page.waitForTimeout(WARMUP_MS);

			result ??= createResultFile(browserName, browser.version(), headless);

			const measure = (name: WindowName, sampleFrames: boolean, action: () => Promise<string[]>) =>
				measureWindow(page, browserName, browserPid, rep, name, sampleFrames, action);

			await measure('idle', false, async () => {
				await page.waitForTimeout(WINDOW_MS);
				return [];
			});

			await page.waitForTimeout(SETTLE_MS);
			await measure('panzoom', true, async () => {
				const { moved } = await panAndZoom(page, WINDOW_MS);
				return moved ? [] : ['stage did not move during pan/zoom'];
			});

			await page.waitForTimeout(SETTLE_MS);
			const fleetCount = await sendFleet(page, homePlanetId);
			await page.waitForTimeout(SETTLE_MS);
			await measure('fleets', true, async () => {
				await page.waitForTimeout(WINDOW_MS);
				const remaining = await page.evaluate(() => fleetLayerChildren());
				const warnings = [];
				if (fleetCount === 0) warnings.push('no fleet was sent');
				if (remaining === 0) warnings.push('fleet arrived before the window ended');
				return warnings;
			});
		} finally {
			await browser?.close().catch(() => {});
			await server.close();
		}

		for (const name of Object.keys(runs) as WindowName[]) {
			result!.windows[name] = { runs: runs[name], summary: summarizeRuns(runs[name]) };
		}
		const file = writeResults(result!);
		console.log(`[perf] repetition ${rep} written to ${file}`);
	});
}

async function measureWindow(
	page: Page,
	browserName: string,
	browserPid: number,
	repetition: number,
	name: WindowName,
	sampleFrames: boolean,
	action: () => Promise<string[]>
): Promise<void> {
	const cdp =
		browserName === 'chromium'
			? await page
					.context()
					.newCDPSession(page)
					.catch(() => null)
			: null;
	if (cdp) await cdp.send('Performance.enable');
	const cdpMetrics = async () => {
		if (!cdp) return null;
		const { metrics } = await cdp.send('Performance.getMetrics');
		return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
	};

	const startProbe = await probeEnvironment(page, PROBE_MS);
	recordReferenceDisplay(startProbe);
	// Dropped frames are judged against the display period: the run's reference
	// once a clean probe set it, else this probe's median if it is clean, else
	// (no refreshIntervalMs) the sampled median.
	const referenceHz = result?.meta.refreshHz ?? null;
	const refreshIntervalMs =
		referenceHz !== null
			? 1000 / referenceHz
			: isCleanProbe(startProbe)
				? (startProbe.medianIntervalMs ?? undefined)
				: undefined;

	await page.evaluate((options) => window.__perf!.reset(options), {
		sampleFrames,
		refreshIntervalMs
	});
	const cdpStart = await cdpMetrics();
	const cpuStart = await sampleTree(browserPid);

	const warnings = await action();

	const cpuEnd = await sampleTree(browserPid);
	const cdpEnd = await cdpMetrics();
	const perf = await page.evaluate(() => {
		const snap: PerfSnapshot = window.__perf!.snapshot();
		window.__perf!.reset();
		return snap;
	});
	await cdp?.detach().catch(() => {});
	// Still outside the measured interval: catches throttling that began during
	// the window, which visibility and (emulated) focus cannot show.
	const endProbe = await probeEnvironment(page, PROBE_MS);
	recordReferenceDisplay(endProbe);

	let cdpDelta: Record<string, number> | null = null;
	if (cdpStart && cdpEnd) {
		cdpDelta = {};
		for (const key of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration']) {
			cdpDelta[key] = (cdpEnd[key] ?? 0) - (cdpStart[key] ?? 0);
		}
		cdpDelta['JSHeapUsedSize'] = cdpEnd['JSHeapUsedSize'] ?? 0;
	}

	const cpu = cpuDelta(cpuStart, cpuEnd);
	if (!perf.konva.registered) {
		const unhooked = perf.konva.unhookedLayers;
		const reason =
			unhooked === null
				? 'never registered'
				: unhooked.length > 0
					? `layers not hooked: ${unhooked.join(', ')}`
					: 'stage no longer attached to the document';
		warnings.push(`Konva stage not registered (${reason}): konva.* metrics are missing`);
	}
	if (cpu.exitedProcesses > 0) {
		warnings.push(`${cpu.exitedProcesses} browser process(es) exited during the window`);
	}
	const env = { start: startProbe, end: endProbe };
	warnings.push(...environmentWarnings(env, result?.meta.refreshHz ?? null));
	if (result?.meta.refreshHz === null) {
		warnings.push(
			'no clean rAF probe yet: refresh rate not recorded, dropped frames judged against the sampled median'
		);
	}
	// The game loop ticks at 5/s (MS_PER_TICK); a much lower rate means the
	// browser is throttling timers too.
	const tickRate = perf.ratesPerSec['gameLoop.tick'];
	if (tickRate !== undefined && tickRate > 0 && tickRate < 4) {
		warnings.push(
			`game loop ticked ${tickRate}/s (expected 5): the browser may be throttling a hidden window`
		);
	}

	const run: WindowRun = {
		repetition,
		cpu,
		perf,
		cdp: cdpDelta,
		env,
		warnings,
		metrics: flattenMetrics(cpu, perf, cdpDelta)
	};
	runs[name].push(run);
	console.log(
		`[perf] rep ${repetition} ${name}: cpu ${cpu.totalPct}% ` +
			`(${Object.entries(cpu.byRolePct)
				.map(([r, p]) => `${r} ${p}%`)
				.join(', ')})` +
			(warnings.length ? ` WARN: ${warnings.join('; ')}` : '')
	);
}

/** Records the display refresh rate and pixel ratio once, from a clean probe only. */
function recordReferenceDisplay(probe: EnvProbe): void {
	if (!result || result.meta.refreshHz !== null || !isCleanProbe(probe)) return;
	result.meta.refreshHz = probe.refreshHz;
	result.meta.devicePixelRatio = probe.devicePixelRatio;
}

/**
 * Runs a short rAF loop in the page (and cancels it) to measure the cadence
 * rAF actually runs at, plus visibility, focus and devicePixelRatio. A timer
 * fallback ends the probe if rAF is fully suspended.
 */
async function probeEnvironment(page: Page, durationMs: number): Promise<EnvProbe> {
	return page.evaluate(
		(ms) =>
			new Promise<EnvProbe>((resolve) => {
				const stamps: number[] = [];
				const start = performance.now();
				let rafId = 0;
				let done = false;
				const finish = () => {
					if (done) return;
					done = true;
					cancelAnimationFrame(rafId);
					clearTimeout(timer);
					const elapsed = performance.now() - start;
					const intervals = stamps
						.slice(1)
						.map((t, i) => t - stamps[i])
						.sort((a, b) => a - b);
					const mid = Math.floor(intervals.length / 2);
					const median =
						intervals.length === 0
							? null
							: intervals.length % 2
								? intervals[mid]
								: (intervals[mid - 1] + intervals[mid]) / 2;
					const r = (n: number) => Math.round(n * 10) / 10;
					resolve({
						durationMs: r(elapsed),
						frames: stamps.length,
						rafPerSec: r(stamps.length / (elapsed / 1000)),
						medianIntervalMs: median === null ? null : Math.round(median * 1000) / 1000,
						refreshHz: median ? r(1000 / median) : null,
						visibilityState: document.visibilityState,
						hasFocus: document.hasFocus(),
						devicePixelRatio: window.devicePixelRatio
					});
				};
				const tick = (ts: number) => {
					stamps.push(ts);
					if (performance.now() - start < ms) rafId = requestAnimationFrame(tick);
					else finish();
				};
				rafId = requestAnimationFrame(tick);
				const timer = setTimeout(finish, ms + 250);
			}),
		durationMs
	);
}

function createResultFile(
	browserName: string,
	browserVersion: string,
	headless: boolean
): PerfResultFile {
	return {
		schemaVersion: 3,
		meta: {
			label: process.env.PERF_LABEL || null,
			...gitInfo(),
			date: new Date().toISOString(),
			browser: headless ? `${browserName}-headless` : browserName,
			browserVersion,
			...machineInfo(),
			viewport: VIEWPORT,
			windowMs: WINDOW_MS,
			warmupMs: WARMUP_MS,
			repetitions: REPETITIONS,
			galaxySeed: BENCHMARK_GAME.galaxySeed,
			refreshHz: null,
			devicePixelRatio: null
		},
		windows: {}
	};
}

const HEADLINE_METRICS = [
	'cpu.totalPct',
	'frames.fps',
	'frames.p95Ms',
	'frames.droppedPct',
	'rendered.fps',
	'konva.nodesCreatedPerSec',
	'rate.store.clientGameModel.set',
	'time.canvas.updateGameObjects.msPerSec',
	'time.engine.advanceClientGameModelTime.msPerSec',
	'time.store.clientGameModel.fanout.msPerSec'
];

function printSummary(file: PerfResultFile): void {
	console.log(`\n[perf] ${file.meta.browser} ${file.meta.browserVersion} @ ${file.meta.gitSha}`);
	let violations = 0;
	for (const [name, data] of Object.entries(file.windows)) {
		if (!data) continue;
		console.log(`  ${name} (n=${data.runs.length})`);
		for (const metric of HEADLINE_METRICS) {
			const s = data.summary[metric];
			if (s) console.log(`    ${metric.padEnd(50)} ${s.median}  [${s.min} – ${s.max}]`);
		}
		for (const b of checkBudgets(name as WindowName, data.summary)) {
			if (b.status !== 'pass') violations++;
			const value = b.value === null ? 'not recorded' : b.value;
			console.log(
				`    budget ${b.status.toUpperCase()} ${b.metric} = ${value} (max ${b.max}): ${b.why}`
			);
		}
	}
	if (ENFORCE_BUDGETS && violations > 0) {
		throw new Error(`${violations} perf budget(s) exceeded or missing (PERF_ENFORCE_BUDGETS=1)`);
	}
}
