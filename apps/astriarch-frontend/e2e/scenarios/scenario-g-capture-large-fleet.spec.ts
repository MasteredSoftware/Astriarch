/**
 * Scenario G — a large mixed fleet captures the AI's home planet (regression test for issue #83).
 *
 * Issue #83: landing a large fleet on an enemy planet crashed the frontend with Svelte's
 * `each_key_duplicate`, and SvelteKit replaced the game with its default "500 Internal
 * Error" page. Cause: TaskNotificationPanel keyed its list by `type + planetId`, a numeric
 * addition (TaskNotificationType is a numeric enum), so e.g. (BuildQueueEmpty, T) and
 * (CitizensProtesting, T-2) both had key T. A captured planet always gets an empty build
 * queue, hence a BuildQueueEmpty task.
 *
 * Setup (POST /api/test/setup-fleet-attack, seed 20261125, 2 systems x 4 planets, one Easy AI):
 *   T     — the AI home planet (the target)
 *   S=T+2 — the human's, holding 47 ships (10 Scouts, 10 Destroyers, 15 Cruisers, 12 Battleships;
 *           strength 744)
 *   R=T+1 — the AI's, so capturing T does not destroy the AI and end the game
 *   C=T-2 — the human's, every citizen protesting: task (CitizensProtesting, C) has the old
 *           key (T-2)+2 = T, which deterministically collides with (BuildQueueEmpty, T)
 *           after the capture.
 *
 * Flow: Fleet Command on S, Select All, click T on the canvas, Send Ships; wait for the
 * first of (a) T owned, (b) an `each_key_duplicate` console/page error, (c) a timeout.
 * On (b) the test fails at once with `ISSUE #83: ...` and reports whether the game UI was
 * replaced by the SvelteKit error page. Otherwise it watches POST_CAPTURE_MS more and
 * checks the model, the Fleet Command view, the task panel and the console, and that the
 * game UI is still rendered (no error page).
 *
 * The timeline (setup, frames, console, task snapshots, Fleet Command samples recorded
 * from Send onwards) is attached as `scenario-g-timeline.json`.
 */

import { writeFileSync } from 'node:fs';
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, openFleetCommandView, assertNoDesyncError } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';
import { setGalaxySeed, setupFleetAttack, type FleetAttackSetup } from '../helpers/testBackend';
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
import type { FleetViewSample, TaskNotificationSample } from '../../src/lib/testing/testHooksTypes';

const SEED = 20261125;
const FLEET_SIZE = 47;
const MS_PER_CYCLE = 10_000; // Very Fast
/** Watch time after the capture: a host advance round trip plus the checksum debounce. */
const POST_CAPTURE_MS = 12_000;
/** TaskNotificationType values (numeric enum in astriarch-engine clientModel.ts). */
const BUILD_QUEUE_EMPTY = 0;
const CITIZENS_PROTESTING = 2;

/**
 * Console errors that are expected and do not fail the test. Keep this empty
 * unless an entry has a comment explaining why it is harmless.
 */
const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [];

const NOTABLE_CONSOLE = /each_key_duplicate|Fleet checksum mismatch|Fleet data refreshed/;
const KEY_DUPLICATE = /each_key_duplicate/;

interface ClientEventRecord {
	wallMs: number;
	type: string;
	planetId?: number;
}

/** Whether the game UI is mounted, and what SvelteKit's error page (if any) shows. */
interface PageState {
	gameViewRendered: boolean;
	headings: string[];
	bodyText: string;
}

function readPageState(page: Page): Promise<PageState> {
	return page.evaluate(() => ({
		gameViewRendered: !!document.querySelector('[data-testid="view-game"]'),
		headings: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent?.trim() ?? ''),
		bodyText: document.body.innerText.slice(0, 300)
	}));
}

/** SvelteKit's default error page is `<h1>{status}</h1><p>{message}</p>`. */
function describePageState(s: PageState): string {
	const status = s.headings.find((h) => /^\d{3}$/.test(h));
	if (!s.gameViewRendered && status) {
		return `PAGE CRASHED: the game UI is gone and SvelteKit's error page shows ${JSON.stringify(s.bodyText)}`;
	}
	if (!s.gameViewRendered) {
		return `PAGE CRASHED: the game UI is gone (page text ${JSON.stringify(s.bodyText)})`;
	}
	return 'the game UI is still rendered';
}

const pairKey = (t: TaskNotificationSample) => `${t.type}:${t.planetId}`;
const sorted = (ids: string[]) => [...ids].sort();

function readDomTasks(page: Page): Promise<TaskNotificationSample[]> {
	return page.locator('[data-testid="task-item"]').evaluateAll((els) =>
		els.map((el) => ({
			type: Number(el.getAttribute('data-task-type')),
			planetId: Number(el.getAttribute('data-planet-id'))
		}))
	);
}

test.describe('Scenario G — large fleet captures the AI home planet (#83)', () => {
	test.beforeAll(async () => {
		await cleanupTestData();
		await setGalaxySeed(SEED);
	});

	test.afterAll(async () => {
		await setGalaxySeed(null);
		await cleanupTestData();
	});

	test('capturing an enemy planet keeps the game UI, task panel and fleet view consistent', async ({
		page,
		context
	}) => {
		test.setTimeout(240_000);
		const gameName = testGameName('scenG_capture');

		const frames: FrameRecord[] = [];
		const clientEvents: ClientEventRecord[] = [];
		const consoleLog: ConsoleRecord[] = [];
		const pageErrors: { wallMs: number; message: string }[] = [];
		// Resolved by the console/pageerror listeners on the first each_key_duplicate (no polling).
		// Cast so TS does not narrow it to null (it is set from listener callbacks).
		let keyDuplicate = null as { wallMs: number; text: string } | null;
		let keyDuplicateWaiters: (() => void)[] = [];
		const onKeyDuplicate = (text: string) => {
			if (keyDuplicate) return;
			keyDuplicate = { wallMs: Date.now(), text };
			const waiters = keyDuplicateWaiters;
			keyDuplicateWaiters = [];
			waiters.forEach((resolve) => resolve());
		};
		const keyDuplicateSeen = () =>
			new Promise<void>((resolve) => {
				if (keyDuplicate) resolve();
				else keyDuplicateWaiters.push(resolve);
			});

		await context.addInitScript('window.__ASTRIARCH_TEST__ = true;\n' + PAGE_HELPERS_SCRIPT);

		page.on('console', (msg: ConsoleMessage) => {
			const type = msg.type();
			const text = msg.text();
			if (type === 'error' || type === 'warning' || NOTABLE_CONSOLE.test(text)) {
				consoleLog.push({ wallMs: Date.now(), type, text });
			}
			if (KEY_DUPLICATE.test(text)) onKeyDuplicate(text);
		});
		page.on('pageerror', (err) => {
			pageErrors.push({ wallMs: Date.now(), message: err.message });
			if (KEY_DUPLICATE.test(err.message)) onKeyDuplicate(err.message);
		});
		page.on('websocket', (ws) => {
			ws.on('framereceived', ({ payload }) => {
				const msg = parseFrame(payload);
				if (!msg || !TRACKED_RECV.has(msg.type)) return;
				const wallMs = Date.now();
				frames.push({
					wallMs,
					dir: 'recv',
					type: msg.type,
					summary: summarize(msg.type, msg.payload)
				});
				if (msg.type === 'CLIENT_EVENT') {
					const events =
						(msg.payload?.events as
							| { type?: string; data?: { planetId?: number } }[]
							| undefined) ?? [];
					for (const e of events) {
						clientEvents.push({ wallMs, type: e.type ?? '?', planetId: e.data?.planetId });
					}
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

		let setup: FleetAttackSetup | null = null;
		let tasksBefore: TaskNotificationSample[] = [];
		let tasksAfter: TaskNotificationSample[] = [];
		let samples: FleetViewSample[] = [];
		let recording = false;
		let sendClickMs: number | null = null;
		let capturedMs: number | null = null;
		let pageStateAfter: PageState | null = null;

		const writeTimeline = async () => {
			const timelinePath = test.info().outputPath('scenario-g-timeline.json');
			writeFileSync(
				timelinePath,
				JSON.stringify(
					{
						seed: SEED,
						setup,
						sendClickMs,
						capturedMs,
						keyDuplicate,
						pageStateAfter,
						tasksBefore,
						tasksAfter,
						clientEvents,
						samples,
						frames,
						console: consoleLog,
						pageErrors
					},
					null,
					2
				)
			);
			await test.info().attach('scenario-g-timeline.json', {
				contentType: 'application/json',
				path: timelinePath
			});
		};

		/** #80 observation (never asserted): what the Fleet Command view did after the error. */
		const annotateIssue80 = () => {
			if (!keyDuplicate) return;
			const after = samples.filter((s) => s.wallMs >= keyDuplicate!.wallMs);
			const unmounted = after.filter((s) => s.viewPlanetId === null).length;
			const stale = after.filter(
				(s) =>
					s.viewPlanetId !== null && sorted(s.viewShipIds).join() !== sorted(s.modelShipIds).join()
			).length;
			test.info().annotations.push({
				type: 'issue-80-observation',
				description:
					`${after.length} Fleet Command samples after the first each_key_duplicate: ` +
					`${unmounted} with the view unmounted, ${stale} with a mounted view not matching the model`
			});
		};

		try {
			// --- Create and start the pinned game ---------------------------------------
			await openLobby(page);
			await waitForConnected(page);
			await createGame(page, 'Conqueror');
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

			// --- Stage the fleet next to the AI home and resync -------------------------
			setup = await setupFleetAttack(gameName);
			const { targetPlanetId: T, stagingPlanetId: S, collisionPlanetId: C } = setup;
			expect(setup.shipIds, 'staged fleet size').toHaveLength(FLEET_SIZE);
			expect(setup.fleetStrength, 'staged fleet strength').toBeGreaterThanOrEqual(700);
			const captureTimeoutMs = setup.hexDistance * MS_PER_CYCLE * 2 + 20_000;
			await page.evaluate(() => window.__astriarchTest!.requestStateSync());
			await page.waitForFunction(
				([s, c, n]) => {
					const api = window.__astriarchTest!;
					const owned = api.ownedPlanetIds();
					return owned.includes(s) && owned.includes(c) && api.mobileShipIds(s).length === n;
				},
				[S, C, FLEET_SIZE] as const,
				{ timeout: 15_000 }
			);

			// --- Precondition: the colliding task exists and nothing has crashed yet ----
			await page.waitForFunction(
				([c, protesting]) =>
					window
						.__astriarchTest!.taskNotifications()
						.some((t) => t.type === protesting && t.planetId === c),
				[C, CITIZENS_PROTESTING] as const,
				{ timeout: 15_000 }
			);
			tasksBefore = await page.evaluate(() => window.__astriarchTest!.taskNotifications());
			expect(keyDuplicate, 'no each_key_duplicate before the attack').toBeNull();

			// --- Send all of S's ships to T ---------------------------------------------
			await openFleetCommandView(page);
			await selectPlanetInFleetCommand(page, S);
			await expect(page.locator('[data-testid="ship-card"]')).toHaveCount(FLEET_SIZE);
			await page.getByRole('button', { name: /Select All/ }).click();
			await clickDestinationPlanet(page, T);
			await page.evaluate(() => window.__astriarchTest!.startRecording());
			recording = true;
			sendClickMs = Date.now();
			await page.locator('[data-testid="send-ships-btn"]').click();
			await page.waitForFunction(
				(s) =>
					window.__astriarchTest!.fleetsInTransit().length === 1 &&
					window.__astriarchTest!.mobileShipIds(s).length === 0,
				S,
				{ timeout: 15_000 }
			);
			await expectFleetHeadedTo(page, T);

			// --- Wait for the capture, an each_key_duplicate, or a timeout --------------
			const captured = page
				.waitForFunction((t) => window.__astriarchTest!.ownedPlanetIds().includes(t), T, {
					timeout: captureTimeoutMs
				})
				.then(() => 'captured' as const);
			const outcome = await Promise.race([
				captured,
				keyDuplicateSeen().then(() => 'key-duplicate' as const)
			]).catch((e: Error) => `timeout: ${e.message}`);
			if (outcome === 'captured') {
				capturedMs = Date.now();
				// Keep watching: tasks for the captured planet appear over the next ticks.
				await Promise.race([page.waitForTimeout(POST_CAPTURE_MS), keyDuplicateSeen()]);
			}

			if (keyDuplicate) {
				// Give SvelteKit's error boundary a moment to swap in its error page.
				await page
					.waitForFunction(() => !document.querySelector('[data-testid="view-game"]'), undefined, {
						timeout: 3_000
					})
					.catch(() => {});
				pageStateAfter = await readPageState(page);
				await page.screenshot({ path: test.info().outputPath('issue-83-crash.png') });
				throw new Error(
					`ISSUE #83: each_key_duplicate after capturing planet ${T}` +
						`${capturedMs === null ? ' (before the client saw the capture)' : ''}: ` +
						`${keyDuplicate.text}\n${describePageState(pageStateAfter)}`
				);
			}
			if (outcome !== 'captured') {
				pageStateAfter = await readPageState(page);
				throw new Error(
					`Planet ${T} was not captured within ${captureTimeoutMs}ms (${outcome}); ` +
						describePageState(pageStateAfter)
				);
			}

			// --- Assertions after the capture -------------------------------------------
			pageStateAfter = await readPageState(page);
			expect(pageStateAfter.gameViewRendered, describePageState(pageStateAfter)).toBe(true);
			await expect(page.locator('[data-testid="view-game"]')).toBeVisible();

			// 1. The server reported the capture of T and no failed attack.
			expect(
				clientEvents.filter((e) => e.type === 'PLANET_CAPTURED' && e.planetId === T),
				`PLANET_CAPTURED for planet ${T}`
			).toHaveLength(1);
			expect(clientEvents.filter((e) => e.type === 'FLEET_ATTACK_FAILED')).toEqual([]);

			// 2. T is owned and no fleet is left in transit (no ghost fleet).
			const api = await page.evaluate((t) => {
				const a = window.__astriarchTest!;
				return {
					owned: a.ownedPlanetIds(),
					inTransit: a.fleetsInTransit(),
					allShipIds: a.allStarshipIds(),
					onT: a.mobileShipIds(t)
				};
			}, T);
			expect(api.owned).toContain(T);
			expect(api.inTransit, 'fleets in transit after the capture').toEqual([]);

			// 3. Ship ids are unique and T holds survivors of the launched fleet only.
			expect(api.allShipIds.length - new Set(api.allShipIds).size, 'duplicate ship ids').toBe(0);
			expect(api.onT.length).toBeGreaterThan(0);
			expect(api.onT.length).toBeLessThanOrEqual(FLEET_SIZE);
			expect(api.onT.filter((id) => !setup!.shipIds.includes(id))).toEqual([]);

			// 4. Fleet Command on T shows exactly the model's ships.
			await selectPlanetInFleetCommand(page, T);
			await expect
				.poll(async () =>
					sorted(
						await page
							.locator('[data-testid="ship-card"]')
							.evaluateAll((els) => els.map((el) => el.getAttribute('data-ship-id') ?? ''))
					)
				)
				.toEqual(sorted(await page.evaluate((t) => window.__astriarchTest!.mobileShipIds(t), T)));

			// 5. The task panel renders the model's tasks, each (type, planet) once, including
			//    the pair whose old key collided.
			await expect
				.poll(async () => {
					const dom = sorted((await readDomTasks(page)).map(pairKey));
					const model = sorted(
						(await page.evaluate(() => window.__astriarchTest!.taskNotifications())).map(pairKey)
					);
					return dom.join() === model.join();
				})
				.toBe(true);
			const domTasks = (await readDomTasks(page)).map(pairKey);
			tasksAfter = await page.evaluate(() => window.__astriarchTest!.taskNotifications());
			expect(domTasks.length - new Set(domTasks).size, 'duplicate task items').toBe(0);
			expect(domTasks).toEqual(
				expect.arrayContaining([
					pairKey({ type: BUILD_QUEUE_EMPTY, planetId: T }),
					pairKey({ type: CITIZENS_PROTESTING, planetId: C })
				])
			);

			// 6. No page errors, console errors, key duplicates or fleet resyncs.
			expect(pageErrors, 'page errors').toEqual([]);
			const consoleErrors = consoleLog.filter(
				(c) =>
					KEY_DUPLICATE.test(c.text) ||
					(c.type === 'error' && !CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(c.text)))
			);
			expect(consoleErrors, 'console errors').toEqual([]);
			expect(
				frames.filter(
					(f) =>
						f.type === 'PLANET_SHIPS_CHECKSUM_RESULT' &&
						(f.summary as { match?: boolean } | undefined)?.match === false
				),
				'fleet checksum mismatches'
			).toEqual([]);
			expect(
				consoleLog.filter((c) => /Fleet checksum mismatch|Fleet data refreshed/.test(c.text)),
				'fleet resyncs'
			).toEqual([]);
			await expect(page.getByText('Fleet data refreshed')).toHaveCount(0);
			await assertNoDesyncError(page);
		} finally {
			if (recording) {
				samples = await page
					.evaluate(() => window.__astriarchTest!.stopRecording())
					.catch(() => [] as FleetViewSample[]);
			}
			if (tasksAfter.length === 0) {
				tasksAfter = await page
					.evaluate(() => window.__astriarchTest?.taskNotifications() ?? [])
					.catch(() => []);
			}
			annotateIssue80();
			await writeTimeline();
		}
	});
});
