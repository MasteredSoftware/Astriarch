/**
 * Scenario C — Resume an in-progress game
 *
 * Flow:
 *  1. Create and start a 1-human-vs-AI game.
 *  2. Confirm the in-game view is shown.
 *  3. Navigate away (simulate a disconnect/reload by going to '/').
 *  4. Return to the lobby — the in-progress game should appear.
 *  5. Resume the game and confirm the in-game view is restored.
 */

import { test, expect } from '@playwright/test';
import {
	openLobby,
	waitForConnected,
	createGame,
	selectGameByName,
	resumeGame
} from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, assertNoDesyncError } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';

test.beforeEach(async () => {
	await cleanupTestData();
});

test.afterEach(async () => {
	await cleanupTestData();
});

test('start a game, return to lobby, resume and reach in-game view', async ({ page }) => {
	const gameName = testGameName('scenarioC');

	// --- Start a game ---
	await openLobby(page);
	await waitForConnected(page);
	await createGame(page, 'TestPlayer1');

	const gameNameInput = page.locator('[data-testid="game-name-input"]');
	if (await gameNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await gameNameInput.fill(gameName);
		await gameNameInput.blur();
	}

	await setOpponentSlot(page, 1, OpponentType.NORMAL_COMPUTER);
	await startGame(page);
	await waitForGameView(page);

	// --- Simulate disconnect by reloading ---
	await page.reload();

	// After reload the app returns to the main/welcome screen.
	// Re-open the lobby so the in-progress game list is visible.
	await openLobby(page);

	// The in-progress game should appear in the games list.
	await selectGameByName(page, gameName);

	// Resume game and confirm view restoration.
	await resumeGame(page);
	await expect(page.locator('[data-testid="view-game"]')).toBeVisible();
	await assertNoDesyncError(page);
});
