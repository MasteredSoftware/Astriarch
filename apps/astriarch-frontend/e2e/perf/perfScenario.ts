/**
 * Game setup and scripted interactions for the perf benchmark.
 *
 * The game is pinned so every run draws the same galaxy:
 *   - galaxy seed via the test-only backend route POST /api/test/galaxy-seed
 *   - explicit game options (not UI defaults, which may change)
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, openFleetCommandView } from '../helpers/inGame';
import { testGameName } from '../helpers/cleanup';
import { buildBarFraction } from './results';

// playwright.perf.config.ts sets the default (8032) before this is imported.
const BACKEND_PORT = process.env.TEST_BACKEND_PORT ?? '8032';
const BACKEND_HTTP = `http://localhost:${BACKEND_PORT}`;

/** Pinned benchmark game. Change only deliberately: it resets comparability. */
export const BENCHMARK_GAME = {
	galaxySeed: 20261120,
	galaxySize: '3', // Medium
	systemsToGenerate: '4',
	planetsPerSystem: '6',
	gameSpeed: '3', // Normal
	distributePlanetsEvenly: true,
	// Quick start gives the home planet a Scout; without it the home planet
	// only has immobile System Defense ships, so no fleet could be sent.
	quickStart: true,
	opponents: [
		OpponentType.NORMAL_COMPUTER,
		OpponentType.NORMAL_COMPUTER,
		OpponentType.NORMAL_COMPUTER
	]
} as const;

export async function setGalaxySeed(seed: number | null): Promise<void> {
	const res = await fetch(`${BACKEND_HTTP}/api/test/galaxy-seed`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ seed })
	});
	if (!res.ok) {
		throw new Error(
			`POST /api/test/galaxy-seed failed (HTTP ${res.status}). ` +
				'The perf harness starts its own backend (NODE_ENV=test) on port ' +
				`${BACKEND_PORT}. If another process holds that port, stop it or pick a free ` +
				'one with TEST_BACKEND_PORT and rerun.'
		);
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

/**
 * Creates and starts the pinned benchmark game, waits for the galaxy to render,
 * and returns the home planet's id (the game auto-selects it at start).
 */
export async function startBenchmarkGame(page: Page): Promise<number> {
	await setGalaxySeed(BENCHMARK_GAME.galaxySeed);

	await openLobby(page);
	await waitForConnected(page);
	await createGame(page, 'PerfPlayer');

	await page.locator('[data-testid="game-name-input"]').fill(testGameName('perf'));
	await page.locator('[data-testid="game-name-input"]').blur();

	await selectById(page, 'turnTimeLimit', BENCHMARK_GAME.gameSpeed);
	await selectById(page, 'galaxySize', BENCHMARK_GAME.galaxySize);
	await selectById(page, 'systemsToGenerate', BENCHMARK_GAME.systemsToGenerate);
	await selectById(page, 'planetsPerSystem', BENCHMARK_GAME.planetsPerSystem);
	await setCheckbox(page, 'distributePlanets', BENCHMARK_GAME.distributePlanetsEvenly);
	await setCheckbox(page, 'quickStart', BENCHMARK_GAME.quickStart);
	for (const [i, type] of BENCHMARK_GAME.opponents.entries()) {
		await setOpponentSlot(page, i + 1, type);
	}

	await startGame(page);
	await waitForGameView(page);

	// Wait for the canvas to draw the planets and select the home planet.
	const handle = await page.waitForFunction(
		() =>
			planetNodes()
				.find((n) => n.getAttr('selected'))
				?.getAttr('planetId') as number | undefined,
		undefined,
		{ timeout: 20_000 }
	);
	return (await handle.jsonValue()) as number;
}

/** Repeatedly drags the galaxy and zooms in/out until durationMs elapses. */
export async function panAndZoom(page: Page, durationMs: number): Promise<{ moved: boolean }> {
	const box = await page.locator('canvas').first().boundingBox();
	if (!box) throw new Error('Galaxy canvas not found');
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const before = await stageTransform(page);

	const end = Date.now() + durationMs;
	let dir = 1;
	while (Date.now() < end) {
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx + 150 * dir, cy + 80 * dir, { steps: 20 });
		await page.mouse.up();
		for (let i = 0; i < 3 && Date.now() < end; i++) {
			await page.mouse.wheel(0, -120 * dir);
			await page.waitForTimeout(50);
		}
		dir = -dir;
	}

	const after = await stageTransform(page);

	// Zooms center on the cursor, so the alternating drags and zooms drift.
	// Restore the starting view so later windows see the same galaxy framing.
	await page.evaluate((t) => {
		const stage = planetNodes()[0]?.getStage();
		stage?.scale({ x: t.scale, y: t.scale });
		stage?.position({ x: t.x, y: t.y });
	}, before);

	return {
		moved: before.x !== after.x || before.y !== after.y || before.scale !== after.scale
	};
}

/**
 * Clicks the home planet on the canvas and waits until it is selected.
 * Releasing a pan drag fires a DOM click on the canvas, which may have selected
 * whatever planet was under the cursor, so callers re-select it first.
 */
async function selectHomePlanet(page: Page, homePlanetId: number): Promise<void> {
	const box = await page.locator('canvas').first().boundingBox();
	if (!box) throw new Error('Galaxy canvas not found');
	const homePos = await page.evaluate((id) => {
		const home = planetNodes().find((n) => n.getAttr('planetId') === id);
		return home ? home.getAbsolutePosition() : null;
	}, homePlanetId);
	if (!homePos) throw new Error(`Home planet ${homePlanetId} not found on the canvas`);
	if (homePos.x < 0 || homePos.y < 0 || homePos.x > box.width || homePos.y > box.height) {
		throw new Error(`Home planet ${homePlanetId} is off screen at ${JSON.stringify(homePos)}`);
	}
	await page.mouse.click(box.x + homePos.x, box.y + homePos.y);
	await page.waitForFunction(
		(id) =>
			planetNodes()
				.find((n) => n.getAttr('planetId') === id)
				?.getAttr('selected') === true,
		homePlanetId,
		{ timeout: 5_000 }
	);
}

/**
 * Sends every mobile ship from the home planet to another planet, so fleets
 * are in transit. Returns the number of fleets on the fleet layer afterwards.
 */
export async function sendFleet(page: Page, homePlanetId: number): Promise<number> {
	const sendBtn = page.locator('[data-testid="send-ships-btn"]');
	const box = await page.locator('canvas').first().boundingBox();
	if (!box) throw new Error('Galaxy canvas not found');

	await selectHomePlanet(page, homePlanetId);

	await openFleetCommandView(page);
	await page.getByRole('button', { name: /Select All/ }).click();

	// Visible planets, farthest from the home (selected) planet first, so the
	// fleet stays in transit for the whole measurement window.
	const targets = await page.evaluate((id) => {
		const nodes = planetNodes();
		const home = nodes.find((n) => n.getAttr('planetId') === id)!;
		const homePos = home.getAbsolutePosition();
		const stage = home.getStage()!;
		return nodes
			.filter((n) => n !== home)
			.map((n) => n.getAbsolutePosition())
			.filter((p) => p.x > 20 && p.y > 20 && p.x < stage.width() - 20 && p.y < stage.height() - 20)
			.sort(
				(a, b) =>
					Math.hypot(b.x - homePos.x, b.y - homePos.y) -
					Math.hypot(a.x - homePos.x, a.y - homePos.y)
			);
	}, homePlanetId);

	const clicked: string[] = [];
	for (const target of targets) {
		const x = box.x + target.x;
		const y = box.y + target.y;
		// What the click will actually hit; a DOM overlay (e.g. a notification) can cover the canvas
		const hit = await page.evaluate(
			([px, py]) => {
				const el = document.elementFromPoint(px!, py!);
				return el
					? `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ')[0]}`
					: 'none';
			},
			[x, y]
		);
		clicked.push(`(${Math.round(target.x)},${Math.round(target.y)})→${hit}`);
		await page.mouse.click(x, y);
		if (await sendBtn.isEnabled()) break;
	}
	try {
		await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
	} catch (e) {
		const shot = `perf-results/sendFleet-failure-${Date.now()}.png`;
		await page.screenshot({ path: shot });
		throw new Error(
			`Send Ships never enabled. Clicked: ${clicked.join(', ')}. Screenshot: ${shot}`,
			{
				cause: e
			}
		);
	}
	await sendBtn.click();

	await page.waitForFunction(() => fleetLayerChildren() > 0, undefined, { timeout: 15_000 });
	return page.evaluate(() => fleetLayerChildren());
}

/**
 * The building the `build` window queues. A Factory costs 32 production; with
 * BENCHMARK_BUILDERS builders on the quick-start home planet (1 Factory) it
 * takes several minutes at Normal speed, so it is still building long after
 * the window (settle + PERF_WINDOW_MS) ends. Change only deliberately, like
 * BENCHMARK_GAME.
 */
export const BENCHMARK_BUILD = 'Factory';

/**
 * Builders the `build` window assigns on the home planet before queueing. Its
 * citizens all start as Farmers, and with no Builder the planet makes no
 * production, so the build never advances ("999 years") and the bar is static.
 * One Builder (of the two starting citizens) leaves one Farmer for food.
 */
export const BENCHMARK_BUILDERS = 1;

/** The build queue's in-progress item; only the first item shows this label. */
const buildInProgress = (page: Page) => page.getByText('Building...', { exact: true });

/** The Builders row of Planet Overview's Worker Assignment (label, -, count, +). */
const buildersRow = (page: Page) =>
	page.getByText('Builders:', { exact: true }).locator('xpath=..');

/**
 * Moves citizens to Builders on the selected planet (Planet Overview open)
 * with the Builders "+" button until it has `builders`, so it makes production.
 */
async function assignBuilders(page: Page, builders: number): Promise<void> {
	const row = buildersRow(page);
	const count = row.locator('span.w-6');
	await count.waitFor({ timeout: 5_000 });
	for (let i = Number(await count.textContent()); i < builders; i++) {
		await row.getByRole('button', { name: '+', exact: true }).click();
		// The server applies it and syncs the planet back
		await expect(count).toHaveText(String(i + 1), { timeout: 5_000 });
	}
}

/**
 * Opens the Planets (Planet Overview) view, selects the home planet, assigns
 * BENCHMARK_BUILDERS builders and queues BENCHMARK_BUILD, so the selected
 * planet shows a build that advances every tick, with its progress bar.
 * Returns whether a build is in progress afterwards.
 */
export async function queueBuild(page: Page, homePlanetId: number): Promise<boolean> {
	// Leave the Fleet Command view first, so the planet click below only selects
	// (the nav tabs are role="button" with the tab label as aria-label).
	await page.getByRole('button', { name: 'Planets', exact: true }).first().click();
	await selectHomePlanet(page, homePlanetId);
	await assignBuilders(page, BENCHMARK_BUILDERS);

	// The card is a div[role=button]; its tooltip trigger wraps it in a <button>.
	const card = page.locator('div[role="button"]').filter({ hasText: BENCHMARK_BUILD }).first();
	await card.waitFor({ timeout: 5_000 });
	await card.click();
	try {
		await expect(buildInProgress(page)).toBeVisible({ timeout: 5_000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * The in-progress build as shown: the bar's target fraction (from its inline
 * style; see buildBarFraction()) and the "done/cost" and "N years" texts.
 * Fields are null when the bar or text is not shown.
 */
export async function buildProgress(
	page: Page
): Promise<{ fraction: number | null; done: string | null; years: string | null }> {
	const shown = await page.evaluate(() => {
		const bar = document.querySelector<HTMLElement>('[data-build-bar]');
		// Bar wrapper -> item card; its last row holds "done/cost" and "N years"
		const card = bar?.closest('.rounded.border');
		const texts = card
			? Array.from(card.querySelectorAll(':scope > div:last-child > span')).map(
					(s) => s.textContent?.trim() ?? ''
				)
			: [];
		return {
			style: bar ? { transform: bar.style.transform, width: bar.style.width } : null,
			done: texts[0] ?? null,
			years: texts[1] ?? null
		};
	});
	return {
		fraction: shown.style ? buildBarFraction(shown.style) : null,
		done: shown.done,
		years: shown.years
	};
}

/** Whether the selected planet still shows a build in progress. */
export async function buildStillInProgress(page: Page): Promise<boolean> {
	return buildInProgress(page).isVisible();
}

/**
 * The build progress bar variant the app is using (its data-build-bar
 * attribute, set by the tickProgress action), or null when no bar is shown.
 */
export async function buildBarVariantShown(page: Page): Promise<string | null> {
	return page.evaluate(
		() => document.querySelector('[data-build-bar]')?.getAttribute('data-build-bar') ?? null
	);
}

async function stageTransform(page: Page) {
	return page.evaluate(() => {
		const stage = planetNodes()[0]?.getStage();
		return { x: stage?.x() ?? 0, y: stage?.y() ?? 0, scale: stage?.scaleX() ?? 1 };
	});
}

/** Installs page-side helpers used by page.evaluate/waitForFunction above. */
export const PAGE_HELPERS_SCRIPT = `
	window.planetNodes = () => {
		const stage = window.Konva && window.Konva.stages[0];
		return stage ? stage.find('.planet') : [];
	};
	window.fleetLayerChildren = () => {
		const stage = window.Konva && window.Konva.stages[0];
		const layer = stage && stage.getLayers().find((l) => l.name() === 'fleet');
		return layer ? layer.getChildren().length : 0;
	};
`;

/* Page-side globals (see PAGE_HELPERS_SCRIPT). */
declare global {
	function planetNodes(): import('konva').default.Node[];
	function fleetLayerChildren(): number;
}
