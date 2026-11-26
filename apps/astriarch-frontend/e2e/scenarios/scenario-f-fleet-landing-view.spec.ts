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
 * Failure messages:
 *   VIEW BUG — the model shows the landed ship but the ship cards do not.
 *   SYNC BUG — the model showed the landed ship, then lost it after a server message.
 * The full timeline is attached to the test result as `fleet-landing-timeline.json`.
 */

import { writeFileSync } from 'node:fs';
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, openFleetCommandView, assertNoDesyncError } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';
import { setGalaxySeed, grantPlanet } from '../helpers/testBackend';
import { PAGE_HELPERS_SCRIPT } from '../perf/perfScenario';
import type { FleetViewSample } from '../../src/lib/testing/testHooksTypes';

const SEED = 20261125;
const POST_ARRIVAL_MS = Number(process.env.SCENARIO_F_POST_ARRIVAL_MS ?? 12_000);
const MS_PER_CYCLE = 10_000; // Very Fast

/**
 * Console errors that are expected and do not fail the test. Keep this empty
 * unless an entry has a comment explaining why it is harmless.
 */
const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [];

const GAME = {
	gameSpeed: '5', // Very Fast: 10s per cycle
	galaxySize: '2', // Small
	systemsToGenerate: '2',
	planetsPerSystem: '4',
	distributePlanetsEvenly: true,
	quickStart: true // home planet starts with a Scout
} as const;

interface FrameRecord {
	wallMs: number;
	dir: 'recv' | 'sent';
	type: string;
	summary?: unknown;
}

interface ConsoleRecord {
	wallMs: number;
	type: string;
	text: string;
}

const TRACKED_RECV = new Set([
	'GAME_STATE_UPDATE',
	'CLIENT_EVENT',
	'PLANET_SHIPS_CHECKSUM_RESULT',
	'COMMAND_ACK',
	'ERROR',
	'ADVANCE_GAME_TIME'
]);
const TRACKED_SENT = new Set([
	'GAME_COMMAND',
	'SYNC_STATE',
	'ADVANCE_GAME_TIME',
	'PLANET_SHIPS_CHECKSUM_CHECK'
]);
const NOTABLE_CONSOLE = /each_key_duplicate|Fleet checksum mismatch|Fleet data refreshed/;

function summarize(type: string, payload: Record<string, unknown> | undefined): unknown {
	if (!payload) return undefined;
	switch (type) {
		case 'GAME_STATE_UPDATE':
			return { currentCycle: payload.currentCycle };
		case 'CLIENT_EVENT':
			return {
				currentCycle: payload.currentCycle,
				events: ((payload.events as { type?: string }[] | undefined) ?? []).map((e) => e.type)
			};
		case 'PLANET_SHIPS_CHECKSUM_RESULT':
		case 'PLANET_SHIPS_CHECKSUM_CHECK':
			return payload;
		case 'GAME_COMMAND':
			return { command: (payload.command as { type?: string } | undefined)?.type };
		case 'COMMAND_ACK':
		case 'ERROR':
			return payload;
		default:
			return undefined;
	}
}

function parseFrame(
	raw: string | Buffer
): { type: string; payload?: Record<string, unknown> } | null {
	try {
		const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
		return typeof msg?.type === 'string' ? msg : null;
	} catch {
		return null;
	}
}

async function selectById(page: Page, id: string, value: string): Promise<void> {
	const select = page.locator(`#${id}`);
	await select.selectOption(value);
	await expect(select).toHaveValue(value);
}

async function setCheckbox(page: Page, id: string, checked: boolean): Promise<void> {
	const box = page.locator(`#${id}`);
	await box.setChecked(checked);
	await expect(box).toBeChecked({ checked });
}

/** Clicks Next planet until both the store and the Fleet Command view show planetId. */
async function selectPlanetInFleetCommand(page: Page, planetId: number): Promise<void> {
	const view = page.locator('[data-testid="view-fleet-command"]');
	for (let i = 0; i < 4; i++) {
		const current = await page.evaluate(() => window.__astriarchTest!.selectedPlanetId());
		if (current === planetId) break;
		await page.getByTitle('Next planet (N)').click();
	}
	await expect
		.poll(() => page.evaluate(() => window.__astriarchTest!.selectedPlanetId()))
		.toBe(planetId);
	await expect(view).toHaveAttribute('data-selected-planet-id', String(planetId));
}

/** Planet `planetId`'s position on the canvas (stage coordinates), or null if not drawn. */
function planetPosition(page: Page, planetId: number) {
	return page.evaluate((id) => {
		const node = planetNodes().find((n) => n.getAttr('planetId') === id);
		return node ? node.getAbsolutePosition() : null;
	}, planetId);
}

/**
 * Clicks planet `planetId` on the galaxy canvas as the Fleet Command destination and
 * waits until Send Ships is enabled. Changing the selected planet pans the canvas
 * (an ~800ms animation), so this waits for the planet to stop moving before each
 * click, and retries with a fresh position. Fails with a screenshot if the planet is
 * off screen or the click never sets a destination.
 */
async function clickDestinationPlanet(page: Page, planetId: number): Promise<void> {
	const box = await page.locator('canvas').first().boundingBox();
	if (!box) throw new Error('Galaxy canvas not found');
	const sendBtn = page.locator('[data-testid="send-ships-btn"]');
	const attempts: string[] = [];
	for (let attempt = 0; attempt < 3; attempt++) {
		// Stable = unchanged across three reads 200ms apart.
		let pos = await planetPosition(page, planetId);
		for (let stable = 0, i = 0; stable < 2 && i < 25; i++) {
			await page.waitForTimeout(200);
			const next = await planetPosition(page, planetId);
			stable = next && pos && next.x === pos.x && next.y === pos.y ? stable + 1 : 0;
			pos = next;
		}
		if (!pos || pos.x < 0 || pos.y < 0 || pos.x > box.width || pos.y > box.height) {
			const shot = test.info().outputPath(`planet-${planetId}-offscreen.png`);
			await page.screenshot({ path: shot });
			throw new Error(
				`Planet ${planetId} is ${pos ? `off screen at ${JSON.stringify(pos)}` : 'not on the canvas'}. Screenshot: ${shot}`
			);
		}
		attempts.push(`(${Math.round(pos.x)},${Math.round(pos.y)})`);
		await page.mouse.click(box.x + pos.x, box.y + pos.y);
		try {
			await expect(sendBtn).toBeEnabled({ timeout: 2_000 });
			return;
		} catch {
			// Retry with a fresh position.
		}
	}
	const shot = test.info().outputPath(`destination-${planetId}-not-set.png`);
	await page.screenshot({ path: shot });
	throw new Error(
		`Clicking planet ${planetId} never enabled Send Ships. Clicked at: ${attempts.join(', ')}. Screenshot: ${shot}`
	);
}

const sorted = (ids: string[]) => [...ids].sort();
const sameIds = (a: string[], b: string[]) =>
	a.length === b.length && sorted(a).every((id, i) => id === sorted(b)[i]);

test.describe('Scenario F — fleet landing on the Fleet Command planet (#80)', () => {
	test.beforeAll(async () => {
		await cleanupTestData();
		await setGalaxySeed(SEED);
	});

	test.afterAll(async () => {
		await setGalaxySeed(null);
		await cleanupTestData();
	});

	test('ship cards match the model on every tick while a fleet lands', async ({
		page,
		context
	}) => {
		test.setTimeout(240_000);
		const gameName = testGameName('scenarioF');

		const frames: FrameRecord[] = [];
		const consoleLog: ConsoleRecord[] = [];
		const pageErrors: { wallMs: number; message: string }[] = [];

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

		await page.waitForFunction(() => !!window.__astriarchTest, undefined, { timeout: 15_000 });
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
		const grant = await grantPlanet(gameName);
		const A = grant.homePlanetId;
		const B = grant.grantedPlanetId;
		expect(selectedHome, 'the game should auto-select the home planet').toBe(A);
		await page.evaluate(() => window.__astriarchTest!.requestStateSync());
		await page.waitForFunction(
			(b) =>
				window.__astriarchTest!.ownedPlanetIds().includes(b) &&
				window.__astriarchTest!.mobileShipIds(b).length === 1,
			B,
			{ timeout: 15_000 }
		);

		// --- Send B's Scout to A ---------------------------------------------------------
		await openFleetCommandView(page);
		await selectPlanetInFleetCommand(page, B);
		await expect(page.locator('[data-testid="ship-card"]')).toHaveCount(1);
		await clickDestinationPlanet(page, A);
		await page.locator('[data-testid="send-ships-btn"]').click();
		await page.waitForFunction(
			() => window.__astriarchTest!.fleetsInTransit().length === 1,
			undefined,
			{
				timeout: 15_000
			}
		);

		// --- Watch A while the Scout lands ------------------------------------------------
		await selectPlanetInFleetCommand(page, A);
		const N = await page.evaluate((a) => window.__astriarchTest!.mobileShipIds(a).length, A);
		expect(N, 'home planet should start with its quick-start Scout').toBeGreaterThanOrEqual(1);
		await expect(page.locator('[data-testid="ship-card"]')).toHaveCount(N);

		const recordStartMs = Date.now();
		await page.evaluate(() => window.__astriarchTest!.startRecording());
		let landedMs: number | null = null;
		let landingTimeout: string | null = null;
		const landingTimeoutMs = grant.hexDistance * MS_PER_CYCLE * 2 + 20_000;
		try {
			await page.waitForFunction(
				([a, n]) => window.__astriarchTest!.mobileShipIds(a).length === n + 1,
				[A, N] as const,
				{ timeout: landingTimeoutMs }
			);
			landedMs = Date.now();
			await page.waitForTimeout(POST_ARRIVAL_MS);
		} catch (e) {
			landingTimeout = `Fleet never landed on planet ${A} within ${landingTimeoutMs}ms: ${(e as Error).message}`;
		}
		const samples: FleetViewSample[] = await page.evaluate(() =>
			window.__astriarchTest!.stopRecording()
		);

		const timelinePath = test.info().outputPath('fleet-landing-timeline.json');
		writeFileSync(
			timelinePath,
			JSON.stringify(
				{
					seed: SEED,
					grant,
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
		await test.info().attach('fleet-landing-timeline.json', {
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

		const onA = samples.filter((s) => s.selectedPlanetId === A);
		if (onA.length === 0) failures.push(`No samples recorded with planet ${A} selected`);

		// (a) The view matches the model on every sample.
		for (const s of onA) {
			if (s.viewPlanetId !== A || !sameIds(s.viewShipIds, s.modelShipIds)) {
				failures.push(
					`VIEW BUG at seq ${s.seq} (cycle ${s.cycle}): model [${sorted(s.modelShipIds)}] ` +
						`view planet ${s.viewPlanetId} [${sorted(s.viewShipIds)}]; frames ±1s: ${framesNear(s.wallMs)}`
				);
				break;
			}
		}

		// (b) The view shows the landing within 2 samples of the model.
		const firstModel = onA.findIndex((s) => s.modelShipIds.length === N + 1);
		const firstView = onA.findIndex((s) => s.viewShipIds.length === N + 1);
		if (!landingTimeout && firstModel < 0) {
			failures.push(`Model never showed ${N + 1} ships on planet ${A} in the recorded samples`);
		} else if (firstModel >= 0 && (firstView < 0 || firstView - firstModel > 2)) {
			failures.push(
				`VIEW BUG: model reached ${N + 1} ships at seq ${onA[firstModel]!.seq} but the view ` +
					(firstView < 0 ? 'never did' : `only at seq ${onA[firstView]!.seq}`)
			);
		}

		// (c) Once landed, the model never loses the ship again.
		if (firstModel >= 0) {
			const drop = onA.slice(firstModel).find((s) => s.modelShipIds.length < N + 1);
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

		expect(failures, failures.join('\n')).toEqual([]);
		await expect(page.getByText('Fleet data refreshed')).toHaveCount(0);
		await assertNoDesyncError(page);
	});
});
