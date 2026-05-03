/**
 * Player fixture — wraps an isolated browser context modelling one human player.
 *
 * Usage:
 *   test('...', async ({ playerOne, playerTwo }) => { ... });
 *
 * Each player gets its own cookie jar and localStorage, so multiple players can
 * run in the same Playwright worker without their sessions colliding.
 */

import { test as base, type BrowserContext, type Page } from '@playwright/test';

export interface Player {
	context: BrowserContext;
	page: Page;
	name: string;
}

interface PlayerFixtures {
	playerOne: Player;
	playerTwo: Player;
}

export const test = base.extend<PlayerFixtures>({
	playerOne: async ({ browser }, use) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await use({ context, page, name: 'TestPlayer1' });
		await context.close();
	},

	playerTwo: async ({ browser }, use) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await use({ context, page, name: 'TestPlayer2' });
		await context.close();
	}
});

export { expect } from '@playwright/test';
