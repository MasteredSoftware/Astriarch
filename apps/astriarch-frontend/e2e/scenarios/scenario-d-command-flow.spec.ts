/**
 * Scenario D — Basic in-game command flow
 *
 * Flow:
 *  1. Start a 1-human-vs-AI game.
 *  2. Wait for the in-game view to stabilise.
 *  3. Verify that the GAME_COMMAND pipeline is functional:
 *       - No desync/error notifications are shown after the initial state sync.
 *  4. Navigate to the Fleet Command view.
 *  5. Assert the Send Ships button is present (verifying the fleet UI rendered).
 *
 * Note: Triggering an actual send-ships command requires selecting a planet and
 * destination in the canvas, which needs additional test setup around the Konva
 * canvas. This test focuses on verifying the command pipeline is wired correctly
 * at the UI level without full canvas interaction.
 */

import { test, expect } from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, assertNoDesyncError, openFleetCommandView } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';

test.beforeEach(async () => {
	await cleanupTestData();
});

test.afterEach(async () => {
	await cleanupTestData();
});

test('start game, verify no desync, fleet command UI is reachable', async ({ page }) => {
	const gameName = testGameName('scenarioD');

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

	// Allow initial CLIENT_EVENT messages to arrive and settle.
	await page.waitForTimeout(2_000);

	// No error/desync notification should appear after initial sync.
	await assertNoDesyncError(page);

	// Navigate to the Fleet Command view and assert the Send Ships button exists.
	await openFleetCommandView(page);
	const sendShipsBtn = page.locator('[data-testid="send-ships-btn"]');
	await expect(sendShipsBtn).toBeVisible({ timeout: 10_000 });
});
