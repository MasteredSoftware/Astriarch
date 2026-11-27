/**
 * Fleet scenario helpers shared by scenario F (#80) and scenario G (#83): lobby option
 * setters, Fleet Command planet selection, destination clicks on the galaxy canvas, and
 * websocket frame parsing. Specs cannot import each other without registering each
 * other's tests, so these live here. planetNodes() is the page-side global from
 * PAGE_HELPERS_SCRIPT (e2e/perf/perfScenario.ts).
 */

import { test, expect, type Page } from '@playwright/test';

export const GAME = {
	gameSpeed: '5', // Very Fast: 10s per cycle
	galaxySize: '2', // Small
	systemsToGenerate: '2',
	planetsPerSystem: '4',
	distributePlanetsEvenly: true,
	quickStart: true // home planet starts with a Scout
} as const;

export interface FrameRecord {
	wallMs: number;
	dir: 'recv' | 'sent';
	type: string;
	summary?: unknown;
}

export interface ConsoleRecord {
	wallMs: number;
	type: string;
	text: string;
}

export const TRACKED_RECV = new Set([
	'GAME_STATE_UPDATE',
	'CLIENT_EVENT',
	'PLANET_SHIPS_CHECKSUM_RESULT',
	'COMMAND_ACK',
	'ERROR',
	'ADVANCE_GAME_TIME'
]);
export const TRACKED_SENT = new Set([
	'GAME_COMMAND',
	'SYNC_STATE',
	'ADVANCE_GAME_TIME',
	'PLANET_SHIPS_CHECKSUM_CHECK'
]);
export function summarize(type: string, payload: Record<string, unknown> | undefined): unknown {
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

export function parseFrame(
	raw: string | Buffer
): { type: string; payload?: Record<string, unknown> } | null {
	try {
		const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
		return typeof msg?.type === 'string' ? msg : null;
	} catch {
		return null;
	}
}

export async function selectById(page: Page, id: string, value: string): Promise<void> {
	const select = page.locator(`#${id}`);
	await select.selectOption(value);
	await expect(select).toHaveValue(value);
}

export async function setCheckbox(page: Page, id: string, checked: boolean): Promise<void> {
	const box = page.locator(`#${id}`);
	await box.setChecked(checked);
	await expect(box).toBeChecked({ checked });
}

/** Clicks Next planet until both the store and the Fleet Command view show planetId. */
export async function selectPlanetInFleetCommand(page: Page, planetId: number): Promise<void> {
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
export function planetPosition(page: Page, planetId: number) {
	return page.evaluate((id) => {
		const node = planetNodes().find((n) => n.getAttr('planetId') === id);
		return node ? node.getAbsolutePosition() : null;
	}, planetId);
}

/** True if the topmost element at page point (x, y) is a canvas (not an overlay panel). */
export function canvasIsTopmostAt(page: Page, x: number, y: number) {
	return page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName === 'CANVAS', [
		x,
		y
	] as const);
}

/**
 * Drag start points for the pan fallback, as fractions of the canvas box, in the order
 * they are tried. The first one whose topmost element is the canvas (no overlay panel
 * over it) is used.
 */
const DRAG_START_FRACTIONS: readonly (readonly [number, number])[] = [
	[0.5, 0.5],
	[0.35, 0.5],
	[0.65, 0.5],
	[0.5, 0.35],
	[0.5, 0.65],
	[0.25, 0.25],
	[0.75, 0.25],
	[0.25, 0.75],
	[0.75, 0.75]
];

/**
 * Clicks planet `planetId` on the galaxy canvas as the Fleet Command destination and
 * waits until Send Ships is enabled. Changing the selected planet pans the canvas
 * (an ~800ms animation), so this waits for the planet to stop moving before each
 * click, and retries with a fresh position. A far destination can be off screen or
 * under an overlay panel (the planet info card) while B is selected; then the stage
 * is dragged once (GalaxyCanvas stage is draggable) to bring the planet toward the
 * canvas centre. The drag starts at the first sampled canvas point no overlay covers
 * (DRAG_START_FRACTIONS); if every sample is covered it fails with a screenshot.
 * Once Send Ships is enabled, the Fleet Command destination must be `planetId`;
 * otherwise it fails at once with `wrong destination: ...` and a screenshot (a second
 * click cannot change a destination once chosen). Also fails with a screenshot if the
 * planet still can't be clicked or the click never sets a destination. This all
 * happens before recording starts, so a setup failure here can never be reported as
 * a VIEW or SYNC BUG.
 */
export async function clickDestinationPlanet(page: Page, planetId: number): Promise<void> {
	const box = await page.locator('canvas').first().boundingBox();
	if (!box) throw new Error('Galaxy canvas not found');
	const sendBtn = page.locator('[data-testid="send-ships-btn"]');
	const attempts: string[] = [];
	const centre = { x: box.width / 2, y: box.height / 2 };
	let panned = false;
	for (let attempt = 0; attempt < 3; attempt++) {
		// Stable = unchanged across three reads 200ms apart.
		let pos = await planetPosition(page, planetId);
		for (let stable = 0, i = 0; stable < 2 && i < 25; i++) {
			await page.waitForTimeout(200);
			const next = await planetPosition(page, planetId);
			stable = next && pos && next.x === pos.x && next.y === pos.y ? stable + 1 : 0;
			pos = next;
		}
		const onScreen = !!pos && pos.x >= 0 && pos.y >= 0 && pos.x <= box.width && pos.y <= box.height;
		const clickable = onScreen && (await canvasIsTopmostAt(page, box.x + pos!.x, box.y + pos!.y));
		if (!clickable && pos && !panned) {
			// Drag from an uncovered canvas point by (centre - pos), clamped to the canvas,
			// then re-read the position (the drag also cancels any in-progress auto-pan).
			panned = true;
			const tried: string[] = [];
			let start: { x: number; y: number } | null = null;
			for (const [fx, fy] of DRAG_START_FRACTIONS) {
				const p = { x: box.width * fx, y: box.height * fy };
				tried.push(`(${Math.round(p.x)},${Math.round(p.y)})`);
				if (await canvasIsTopmostAt(page, box.x + p.x, box.y + p.y)) {
					start = p;
					break;
				}
			}
			if (!start) {
				const shot = test.info().outputPath(`planet-${planetId}-no-drag-start.png`);
				await page.screenshot({ path: shot });
				throw new Error(
					`Planet ${planetId} needs a drag-pan but every sampled canvas start point is covered by an overlay` +
						` (tried ${tried.join(', ')}). Screenshot: ${shot}`
				);
			}
			const clamp = (n: number, max: number) => Math.min(Math.max(n, 5), max - 5);
			const to = {
				x: clamp(start.x + (centre.x - pos.x), box.width),
				y: clamp(start.y + (centre.y - pos.y), box.height)
			};
			attempts.push(
				`panned (${Math.round(pos.x)},${Math.round(pos.y)})${onScreen ? ' covered' : ' off screen'}` +
					` from (${Math.round(start.x)},${Math.round(start.y)})`
			);
			await page.mouse.move(box.x + start.x, box.y + start.y);
			await page.mouse.down();
			await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 10 });
			await page.mouse.up();
			attempt--;
			continue;
		}
		if (!clickable || !pos) {
			const shot = test.info().outputPath(`planet-${planetId}-not-clickable.png`);
			await page.screenshot({ path: shot });
			throw new Error(
				`Planet ${planetId} is ${pos ? `${onScreen ? 'covered by an overlay' : 'off screen'} at ${JSON.stringify(pos)}` : 'not on the canvas'}` +
					` (${attempts.join(', ') || 'no pan'}). Screenshot: ${shot}`
			);
		}
		attempts.push(`(${Math.round(pos.x)},${Math.round(pos.y)})`);
		await page.mouse.click(box.x + pos.x, box.y + pos.y);
		let enabled = false;
		try {
			await expect(sendBtn).toBeEnabled({ timeout: 2_000 });
			enabled = true;
		} catch {
			// Retry with a fresh position.
		}
		if (!enabled) continue;
		const got = await page.evaluate(() =>
			window.__astriarchTest!.fleetCommandDestinationPlanetId()
		);
		if (got !== planetId) {
			const shot = test.info().outputPath(`wrong-destination-${planetId}.png`);
			await page.screenshot({ path: shot });
			throw new Error(
				`wrong destination: expected planet ${planetId}, got ${got ?? 'none'}` +
					` (clicked at: ${attempts.join(', ')}). Screenshot: ${shot}`
			);
		}
		return;
	}
	const shot = test.info().outputPath(`destination-${planetId}-not-set.png`);
	await page.screenshot({ path: shot });
	throw new Error(
		`Clicking planet ${planetId} never enabled Send Ships. Clicked at: ${attempts.join(', ')}. Screenshot: ${shot}`
	);
}

/**
 * Checks what the engine received after Send: there is at least one fleet in transit
 * and every one is headed to planet `planetId` (destinationPlanetId from the page
 * hook). Throws `wrong destination: ...` listing the fleets otherwise. `prefix` is
 * prepended to the message (e.g. `[variant baseline] `).
 */
export async function expectFleetHeadedTo(
	page: Page,
	planetId: number,
	prefix = ''
): Promise<void> {
	const fleets = await page.evaluate(() => window.__astriarchTest!.fleetsInTransit());
	if (fleets.length > 0 && fleets.every((f) => f.destinationPlanetId === planetId)) return;
	const ids = fleets.length
		? fleets.map((f) => `fleet ${f.id} -> ${f.destinationPlanetId ?? 'unknown'}`).join(', ')
		: 'no fleet in transit';
	throw new Error(`${prefix}wrong destination: expected planet ${planetId}, got ${ids}`);
}
