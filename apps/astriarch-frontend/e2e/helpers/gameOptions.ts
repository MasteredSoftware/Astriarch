/**
 * Game-options screen helpers.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const DEFAULT_TIMEOUT = 10_000;

/**
 * Opponent type values matching OpponentOptionType in the engine.
 * -2 = Closed, -1 = Open, 0 = Human, 1 = Easy, 2 = Normal, 3 = Hard, 4 = Expert
 */
export const OpponentType = {
	CLOSED: '-2',
	OPEN: '-1',
	HUMAN: '0',
	EASY_COMPUTER: '1',
	NORMAL_COMPUTER: '2',
	HARD_COMPUTER: '3',
	EXPERT_COMPUTER: '4',
} as const;

/** Set a player slot (1-indexed, slot 1 = second player position) to the given opponent type. */
export async function setOpponentSlot(
	page: Page,
	slotIndex: number,
	type: string
): Promise<void> {
	const select = page.locator(`[data-testid="opponent-slot-${slotIndex}"]`);
	await select.waitFor({ timeout: DEFAULT_TIMEOUT });
	await select.selectOption(type);
	await expect(select).toHaveValue(type);
}

/** Click Start Game and wait for the in-game view. */
export async function startGame(page: Page): Promise<void> {
	await page.click('[data-testid="start-game-btn"]');
	await page.waitForSelector('[data-testid="view-game"]', { timeout: 20_000 });
}

/** Wait for the game-options view to be visible. */
export async function waitForGameOptions(page: Page): Promise<void> {
	await page.waitForSelector('[data-testid="view-game-options"]', { timeout: DEFAULT_TIMEOUT });
}
