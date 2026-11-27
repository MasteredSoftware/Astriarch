/**
 * Scenario F — Fleet Command ship count after a fleet lands on the selected planet
 * (regression guard for issue #80).
 *
 * Setup: the player owns planet A (home, quick-start Scout) and planet B, which the
 * test-only route POST /api/test/grant-planet hands over with one Scout. Fleet
 * Command is open on A while B's Scout flies to A and lands.
 *
 * From startRecording() until POST_ARRIVAL_MS after landing, every clientGameModel
 * publish is recorded by the page hook (window.__astriarchTest) as a model sample
 * (A's mobile ship ids in the store) paired with the view after Svelte flushed (the
 * rendered ship cards). Websocket frames and console output are recorded alongside.
 *
 * Variants (one parametrized test each, title suffix `[name]`):
 *   baseline       — seed 20261125, nearest planet (1 hex), Send clicked immediately.
 *   far-at-advance — seed 20260101, a planet 3 hexes away, Send timed so the client
 *                    lands ~100ms after a host ADVANCE_GAME_TIME send (issue #80 cause 2).
 * With SCENARIO_F_SOAK=1 a wider local-only set runs instead (SOAK_VARIANTS: three seeds,
 * nearest plus 3-hex flights at several landing offsets). Run it with --retries=0.
 *
 * A flight takes exactly hexDistance x 10s and the host advances every 10s, so distance
 * alone never moves the landing within the advance interval; only the Send time does.
 * The landing offset actually achieved is recorded (not asserted); a miss of more than
 * 1s adds a `phase-miss` annotation.
 *
 * Failure messages (prefixed with `[variant ...]`):
 *   SELECTION BUG — the selected planet, or the planet Fleet Command showed, moved off
 *                   the watched planet during recording.
 *   VIEW BUG — the model shows the landed ship but the ship cards do not (the view must
 *              match the model on every sample; there is no lag tolerance).
 *   SYNC BUG — the model showed the landed ship, then lost it after a server message.
 * The full timeline is attached as `fleet-landing-timeline-<variant>.json`.
 */

import { writeFileSync } from 'node:fs';
import {
	test,
	expect,
	type Page,
	type BrowserContext,
	type ConsoleMessage
} from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, openFleetCommandView, assertNoDesyncError } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';
import { setGalaxySeed, grantPlanet } from '../helpers/testBackend';
import { PAGE_HELPERS_SCRIPT } from '../perf/perfScenario';
import {
	GAME,
	TRACKED_RECV,
	TRACKED_SENT,
	type FrameRecord,
	type ConsoleRecord,
	summarize,
	parseFrame,
	selectById,
	setCheckbox,
	selectPlanetInFleetCommand,
	clickDestinationPlanet,
	expectFleetHeadedTo
} from '../helpers/fleetScenario';
import type { FleetViewSample } from '../../src/lib/testing/testHooksTypes';

const POST_ARRIVAL_MS = Number(process.env.SCENARIO_F_POST_ARRIVAL_MS ?? 12_000);
const MS_PER_CYCLE = 10_000; // Very Fast
/** Host ADVANCE_GAME_TIME interval (gameSyncIntervalMs in src/lib/services/websocket.ts). */
const HOST_ADVANCE_INTERVAL_MS = 10_000;
/** Mean wait for the client tick that lands the fleet (MS_PER_TICK = 200ms, so ~100ms). */
const TICK_SLACK_MS = 100;
/**
 * If the aimed Send moment passed less than this long ago, click now instead of waiting a
 * whole advance interval (the advance waiter resolves a few ms after the send it reports).
 */
const PHASE_LATE_TOLERANCE_MS = 50;
/** Achieved landing offsets further than this from the target get a `phase-miss` annotation. */
const PHASE_MISS_MS = 1_000;

interface ScenarioFVariant {
	name: string;
	seed: number;
	/** Grant the nearest unowned planet at least this many hexes from home. */
	minHexDistance: number;
	/**
	 * Wanted client landing time relative to a host ADVANCE_GAME_TIME send, mod 10s.
	 * null clicks Send as soon as the destination is set.
	 */
	landingOffsetMs: number | null;
}

// Seeds chosen so the 3-hex planet is in the human's half of the map (3 hexes from the
// human home, 6 from the AI home). Pinned in apps/astriarch-backend/src/utils/testScenarios.spec.ts;
// keep that table in step with these lists.
const SEED_BASELINE = 20261125;
const SEED_S2 = 20260101;
const SEED_S3 = 20261201;

const DEFAULT_VARIANTS: ScenarioFVariant[] = [
	{ name: 'baseline', seed: SEED_BASELINE, minHexDistance: 1, landingOffsetMs: null },
	{ name: 'far-at-advance', seed: SEED_S2, minHexDistance: 3, landingOffsetMs: 100 }
];

const SOAK_OFFSETS_MS = [-250, 0, 100, 250, 5000];
const SOAK_VARIANTS: ScenarioFVariant[] = [SEED_BASELINE, SEED_S2, SEED_S3].flatMap((seed) => [
	{ name: `soak-${seed}-nearest`, seed, minHexDistance: 1, landingOffsetMs: null },
	...SOAK_OFFSETS_MS.map((offset) => ({
		name: `soak-${seed}-hex3-off${offset}`,
		seed,
		minHexDistance: 3,
		landingOffsetMs: offset
	}))
]);

const VARIANTS = process.env.SCENARIO_F_SOAK === '1' ? SOAK_VARIANTS : DEFAULT_VARIANTS;

/**
 * Console errors that are expected and do not fail the test. Keep this empty
 * unless an entry has a comment explaining why it is harmless.
 */
const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [];

const NOTABLE_CONSOLE = /each_key_duplicate|Fleet checksum mismatch|Fleet data refreshed/;

const mod = (n: number, m: number) => ((n % m) + m) % m;
/** Signed distance from `a` to `b` on a circle of length `m`, in [-m/2, m/2). */
const circularDiff = (a: number, b: number, m: number) => mod(a - b + m / 2, m) - m / 2;

const sorted = (ids: string[]) => [...ids].sort();
const sameIds = (a: string[], b: string[]) =>
	a.length === b.length && sorted(a).every((id, i) => id === sorted(b)[i]);

test.describe('Scenario F — fleet landing on the Fleet Command planet (#80)', () => {
	test.beforeAll(async () => {
		await cleanupTestData();
	});

	test.afterEach(async () => {
		await setGalaxySeed(null);
	});

	test.afterAll(async () => {
		await setGalaxySeed(null);
		await cleanupTestData();
	});

	for (const v of VARIANTS) {
		test(`ship cards match the model on every tick while a fleet lands [${v.name}]`, async ({
			page,
			context
		}) => {
			await runScenarioF(page, context, v);
		});
	}
});

async function runScenarioF(
	page: Page,
	context: BrowserContext,
	v: ScenarioFVariant
): Promise<void> {
	const testStartMs = Date.now();
	test.setTimeout(240_000);
	await setGalaxySeed(v.seed);
	// The lobby's game name input has maxlength=50 and silently truncates, so keep it short.
	const gameName = testGameName(
		`scenF_${v.seed}_${v.minHexDistance}_${v.landingOffsetMs ?? 'now'}`
	);
	if (gameName.length > 50) {
		throw new Error(`Game name "${gameName}" is longer than the lobby's 50-character limit`);
	}

	const frames: FrameRecord[] = [];
	const consoleLog: ConsoleRecord[] = [];
	const pageErrors: { wallMs: number; message: string }[] = [];
	// Resolved by the framesent listener on the next ADVANCE_GAME_TIME send (no polling).
	let advanceSentWaiters: (() => void)[] = [];

	await context.addInitScript('window.__ASTRIARCH_TEST__ = true;\n' + PAGE_HELPERS_SCRIPT);

	page.on('console', (msg: ConsoleMessage) => {
		const type = msg.type();
		const text = msg.text();
		if (type === 'error' || type === 'warning' || NOTABLE_CONSOLE.test(text)) {
			consoleLog.push({ wallMs: Date.now(), type, text });
		}
	});
	page.on('pageerror', (err) => pageErrors.push({ wallMs: Date.now(), message: err.message }));
	page.on('websocket', (ws) => {
		ws.on('framereceived', ({ payload }) => {
			const msg = parseFrame(payload);
			if (msg && TRACKED_RECV.has(msg.type)) {
				frames.push({
					wallMs: Date.now(),
					dir: 'recv',
					type: msg.type,
					summary: summarize(msg.type, msg.payload)
				});
			}
		});
		ws.on('framesent', ({ payload }) => {
			const msg = parseFrame(payload);
			if (msg && TRACKED_SENT.has(msg.type)) {
				frames.push({
					wallMs: Date.now(),
					dir: 'sent',
					type: msg.type,
					summary: summarize(msg.type, msg.payload)
				});
				if (msg.type === 'ADVANCE_GAME_TIME') {
					const waiters = advanceSentWaiters;
					advanceSentWaiters = [];
					waiters.forEach((resolve) => resolve());
				}
			}
		});
	});

	// --- Create and start the pinned game -------------------------------------------
	await openLobby(page);
	await waitForConnected(page);
	await createGame(page, 'FleetLander');
	await page.locator('[data-testid="game-name-input"]').fill(gameName);
	await page.locator('[data-testid="game-name-input"]').blur();
	await selectById(page, 'turnTimeLimit', GAME.gameSpeed);
	await selectById(page, 'galaxySize', GAME.galaxySize);
	await selectById(page, 'systemsToGenerate', GAME.systemsToGenerate);
	await selectById(page, 'planetsPerSystem', GAME.planetsPerSystem);
	await setCheckbox(page, 'distributePlanets', GAME.distributePlanetsEvenly);
	await setCheckbox(page, 'quickStart', GAME.quickStart);
	await setOpponentSlot(page, 1, OpponentType.EASY_COMPUTER);
	await startGame(page);
	await waitForGameView(page);

	try {
		await page.waitForFunction(() => !!window.__astriarchTest, undefined, { timeout: 15_000 });
	} catch (e) {
		throw new Error(
			'window.__astriarchTest was not installed within 15s. The hook is only built under ' +
				'`vite dev` or with VITE_ASTRIARCH_TEST_HOOKS=true. If Playwright reused a server ' +
				'already on :4173 (for example a `vite preview` of a production build), stop it and ' +
				`rerun. (${(e as Error).message})`
		);
	}
	const homeHandle = await page.waitForFunction(
		() =>
			planetNodes()
				.find((n) => n.getAttr('selected'))
				?.getAttr('planetId') as number | undefined,
		undefined,
		{ timeout: 20_000 }
	);
	const selectedHome = (await homeHandle.jsonValue()) as number;

	// --- Grant planet B (+1 Scout) and resync the client ----------------------------
	const grant = await grantPlanet(gameName, { minHexDistance: v.minHexDistance });
	const A = grant.homePlanetId;
	const B = grant.grantedPlanetId;
	expect(grant.hexDistance, `[variant ${v.name}] granted planet distance`).toBeGreaterThanOrEqual(
		v.minHexDistance
	);
	const landingTimeoutMs = grant.hexDistance * MS_PER_CYCLE * 2 + 20_000;
	// Never shrink the 240s setup budget; extend it for long flights.
	test.setTimeout(
		Math.max(
			240_000,
			Date.now() -
				testStartMs +
				HOST_ADVANCE_INTERVAL_MS +
				landingTimeoutMs +
				POST_ARRIVAL_MS +
				60_000
		)
	);
	expect(selectedHome, 'the game should auto-select the home planet').toBe(A);
	await page.evaluate(() => window.__astriarchTest!.requestStateSync());
	// Resolved from the hook's clientGameModel subscription (no per-frame polling).
	await page.evaluate(
		([b, ms]) => {
			const a = window.__astriarchTest!;
			return Promise.all([a.waitForOwnedPlanet(b, ms), a.waitForMobileShipCount(b, 1, ms)]).then(
				() => {}
			);
		},
		[B, 15_000] as const
	);

	// --- Send B's Scout to A ---------------------------------------------------------
	await openFleetCommandView(page);
	await selectPlanetInFleetCommand(page, B);
	await expect(page.locator('[data-testid="ship-card"]')).toHaveCount(1);
	await clickDestinationPlanet(page, A);

	// --- Optionally time Send so the landing falls landingOffsetMs after a host advance ---
	const advanceSentMs = () =>
		frames.filter((f) => f.dir === 'sent' && f.type === 'ADVANCE_GAME_TIME').map((f) => f.wallMs);
	let phaseDelayMs: number | null = null;
	if (v.landingOffsetMs !== null) {
		if (advanceSentMs().length === 0) {
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error(`[variant ${v.name}] no ADVANCE_GAME_TIME sent within 11s`)),
					HOST_ADVANCE_INTERVAL_MS + 1_000
				);
				advanceSentWaiters.push(() => {
					clearTimeout(timer);
					resolve();
				});
			});
		}
		const lastAdv = advanceSentMs().at(-1)!;
		// The flight is a whole number of 10s cycles, so landing phase == send phase (mod 10s).
		phaseDelayMs = mod(
			v.landingOffsetMs - TICK_SLACK_MS - (Date.now() - lastAdv),
			HOST_ADVANCE_INTERVAL_MS
		);
		if (phaseDelayMs > HOST_ADVANCE_INTERVAL_MS - PHASE_LATE_TOLERANCE_MS) phaseDelayMs = 0;
		await page.waitForTimeout(phaseDelayMs);
	}
	const sendClickMs = Date.now();
	await page.locator('[data-testid="send-ships-btn"]').click();
	// Resolved from the hook's clientGameModel subscription (no per-frame polling).
	await page.evaluate((ms) => window.__astriarchTest!.waitForFleetsInTransitCount(1, ms), 15_000);
	await expectFleetHeadedTo(page, A, `[variant ${v.name}] `);

	// --- Watch A while the Scout lands ------------------------------------------------
	await selectPlanetInFleetCommand(page, A);
	const N = await page.evaluate((a) => window.__astriarchTest!.mobileShipIds(a).length, A);
	expect(N, 'home planet should start with its quick-start Scout').toBeGreaterThanOrEqual(1);
	await expect(page.locator('[data-testid="ship-card"]')).toHaveCount(N);

	const recordStartMs = Date.now();
	await page.evaluate(() => window.__astriarchTest!.startRecording());
	let landedMs: number | null = null;
	let landingTimeout: string | null = null;
	try {
		// Resolved from the hook's clientGameModel subscription (no per-frame polling).
		await page.evaluate(
			([a, n, t]) => window.__astriarchTest!.waitForMobileShipCount(a, n + 1, t),
			[A, N, landingTimeoutMs] as const
		);
		landedMs = Date.now();
		await page.waitForTimeout(POST_ARRIVAL_MS);
	} catch (e) {
		landingTimeout = `Fleet never landed on planet ${A} within ${landingTimeoutMs}ms: ${(e as Error).message}`;
	}
	const samples: FleetViewSample[] = await page.evaluate(() =>
		window.__astriarchTest!.stopRecording()
	);

	// --- Achieved landing offset (informational, never asserted) -----------------------
	const launchWallMs =
		frames.find(
			(f) =>
				f.dir === 'sent' &&
				f.type === 'GAME_COMMAND' &&
				f.wallMs >= sendClickMs &&
				(f.summary as { command?: string } | undefined)?.command === 'SEND_SHIPS'
		)?.wallMs ?? null;
	const projectedLandingMs =
		launchWallMs === null ? null : launchWallMs + grant.hexDistance * MS_PER_CYCLE;
	const fleetLaunchedRecvMs =
		frames.find(
			(f) =>
				f.dir === 'recv' &&
				f.type === 'CLIENT_EVENT' &&
				f.wallMs >= sendClickMs &&
				((f.summary as { events?: string[] } | undefined)?.events ?? []).includes('FLEET_LAUNCHED')
		)?.wallMs ?? null;
	const landedSampleMs = samples.find((s) => s.modelShipIds.length === N + 1)?.wallMs ?? null;
	let nearestAdvanceSentMs: number | null = null;
	for (const ms of advanceSentMs()) {
		if (
			landedSampleMs !== null &&
			(nearestAdvanceSentMs === null ||
				Math.abs(ms - landedSampleMs) < Math.abs(nearestAdvanceSentMs - landedSampleMs))
		) {
			nearestAdvanceSentMs = ms;
		}
	}
	const achievedOffsetMs =
		landedSampleMs !== null && nearestAdvanceSentMs !== null
			? landedSampleMs - nearestAdvanceSentMs
			: null;
	if (
		v.landingOffsetMs !== null &&
		(achievedOffsetMs === null ||
			Math.abs(circularDiff(achievedOffsetMs, v.landingOffsetMs, HOST_ADVANCE_INTERVAL_MS)) >
				PHASE_MISS_MS)
	) {
		test.info().annotations.push({
			type: 'phase-miss',
			description: `[variant ${v.name}] target landing offset ${v.landingOffsetMs}ms, achieved ${achievedOffsetMs}ms`
		});
	}

	const variantTag =
		`[variant ${v.name} seed=${v.seed} minHex=${v.minHexDistance} hex=${grant.hexDistance} ` +
		`targetOffset=${v.landingOffsetMs} achievedOffset=${achievedOffsetMs}]`;

	const timelineName = `fleet-landing-timeline-${v.name}.json`;
	const timelinePath = test.info().outputPath(timelineName);
	writeFileSync(
		timelinePath,
		JSON.stringify(
			{
				variant: v,
				seed: v.seed,
				grant,
				phaseDelayMs,
				sendClickMs,
				launchWallMs,
				projectedLandingMs,
				fleetLaunchedRecvMs,
				landedSampleMs,
				nearestAdvanceSentMs,
				achievedOffsetMs,
				advanceSentMs: advanceSentMs(),
				baselineShips: N,
				recordStartMs,
				landedMs,
				samples,
				frames,
				console: consoleLog,
				pageErrors
			},
			null,
			2
		)
	);
	await test.info().attach(timelineName, {
		contentType: 'application/json',
		path: timelinePath
	});

	// --- Classify ----------------------------------------------------------------------
	const failures: string[] = [];
	if (landingTimeout) failures.push(landingTimeout);

	const framesNear = (ms: number) =>
		frames
			.filter((f) => Math.abs(f.wallMs - ms) <= 1_000)
			.map((f) => `${f.dir} ${f.type}@${f.wallMs - ms}ms ${JSON.stringify(f.summary ?? '')}`)
			.join('; ') || 'none';

	if (samples.length === 0) failures.push('No samples recorded');

	// Nothing selects a planet during recording, so the selection must stay on A.
	const offA = samples.find((s) => s.selectedPlanetId !== A || s.viewPlanetId !== A);
	if (offA) {
		failures.push(
			`SELECTION BUG at seq ${offA.seq} (cycle ${offA.cycle}): selected planet changed to ` +
				`${offA.selectedPlanetId}, view showed planet ${offA.viewPlanetId} (expected ${A}); ` +
				`frames ±1s: ${framesNear(offA.wallMs)}`
		);
	}

	// (a) The view matches the model on every sample.
	for (const s of samples) {
		if (!sameIds(s.viewShipIds, s.modelShipIds)) {
			failures.push(
				`VIEW BUG at seq ${s.seq} (cycle ${s.cycle}): model [${sorted(s.modelShipIds)}] ` +
					`view planet ${s.viewPlanetId} [${sorted(s.viewShipIds)}]; frames ±1s: ${framesNear(s.wallMs)}`
			);
			break;
		}
	}

	// (b) The landing reaches both the model and the view.
	const firstModel = samples.findIndex((s) => s.modelShipIds.length === N + 1);
	const firstView = samples.findIndex((s) => s.viewShipIds.length === N + 1);
	if (!landingTimeout && firstModel < 0) {
		failures.push(`Model never showed ${N + 1} ships on planet ${A} in the recorded samples`);
	} else if (firstModel >= 0 && firstView < 0) {
		failures.push(
			`VIEW BUG: model reached ${N + 1} ships at seq ${samples[firstModel]!.seq} but the view never did`
		);
	}

	// (c) Once landed, the model never loses the ship again.
	if (firstModel >= 0) {
		const drop = samples.slice(firstModel).find((s) => s.modelShipIds.length < N + 1);
		if (drop) {
			const before = frames.filter((f) => f.dir === 'recv' && f.wallMs <= drop.wallMs).pop();
			failures.push(
				`SYNC BUG: model dropped to ${drop.modelShipIds.length} ships at seq ${drop.seq} (cycle ${drop.cycle}) after ` +
					(before
						? `${before.type} at ${before.wallMs - drop.wallMs}ms ${JSON.stringify(before.summary ?? '')}`
						: 'no server frame')
			);
		}
	}

	// (d) No page errors or unexpected console errors.
	for (const e of pageErrors) failures.push(`Page error: ${e.message}`);
	for (const c of consoleLog) {
		if (/each_key_duplicate/.test(c.text)) failures.push(`each_key_duplicate: ${c.text}`);
		else if (c.type === 'error' && !CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(c.text))) {
			failures.push(`Console error: ${c.text}`);
		}
	}

	// (e) No fleet checksum mismatch / forced resync.
	for (const f of frames) {
		if (
			f.type === 'PLANET_SHIPS_CHECKSUM_RESULT' &&
			(f.summary as { match?: boolean } | undefined)?.match === false
		) {
			failures.push(`Fleet checksum mismatch: ${JSON.stringify(f.summary)}`);
		}
	}
	for (const c of consoleLog) {
		if (/Fleet checksum mismatch|Fleet data refreshed/.test(c.text)) {
			failures.push(`Fleet resync: ${c.text}`);
		}
	}

	expect(failures, `${variantTag}\n${failures.join('\n')}`).toEqual([]);
	await expect(page.getByText('Fleet data refreshed')).toHaveCount(0);
	await assertNoDesyncError(page);
}
