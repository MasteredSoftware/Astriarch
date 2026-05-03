/**
 * Scenario A — 1 human player vs AI opponents
 *
 * Flow:
 *  1. Open lobby and wait for WebSocket connection.
 *  2. Create a game with the E2E naming prefix.
 *  3. Set at least one opponent slot to Normal Computer.
 *  4. Start the game.
 *  5. Assert the in-game view is shown and no desync error surfaces.
 */

import { test, expect } from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, assertNoDesyncError } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';

test.beforeEach(async () => {
	await cleanupTestData();
});

test.afterEach(async () => {
	await cleanupTestData();
});

test('create game, set AI opponent, start game, reach in-game view', async ({ page }) => {
	const gameName = testGameName('scenarioA');

	await openLobby(page);
	await waitForConnected(page);

	// Create game — sets player name and transitions to game-options view.
	await createGame(page, 'TestPlayer1');

	// Set the game name via the input on the game-options screen.
	const gameNameInput = page.locator('[data-testid="game-name-input"]');
	if (await gameNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await gameNameInput.fill(gameName);
		await gameNameInput.blur();
	}

	// Configure at least one opponent as a computer player.
	await setOpponentSlot(page, 1, OpponentType.NORMAL_COMPUTER);

	// Start the game and wait for the in-game view.
	await startGame(page);

	// Verify we are in the game.
	await waitForGameView(page);
	await expect(page.locator('[data-testid="view-game"]')).toBeVisible();

	// Assert no desync/error notifications.
	await assertNoDesyncError(page);
});
