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
 * Sends every mobile ship from the home planet to another planet, so fleets
 * are in transit. Returns the number of fleets on the fleet layer afterwards.
 */
export async function sendFleet(page: Page, homePlanetId: number): Promise<number> {
	const sendBtn = page.locator('[data-testid="send-ships-btn"]');
	const box = await page.locator('canvas').first().boundingBox();
	if (!box) throw new Error('Galaxy canvas not found');

	// Re-select the home planet: releasing a pan drag fires a DOM click on the
	// canvas, which may have selected whatever planet was under the cursor.
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

	for (const target of targets) {
		await page.mouse.click(box.x + target.x, box.y + target.y);
		if (await sendBtn.isEnabled()) break;
	}
	await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
	await sendBtn.click();

	await page.waitForFunction(() => fleetLayerChildren() > 0, undefined, { timeout: 15_000 });
	return page.evaluate(() => fleetLayerChildren());
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
