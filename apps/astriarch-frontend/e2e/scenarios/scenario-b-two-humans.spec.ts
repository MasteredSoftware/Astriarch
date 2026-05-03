/**
 * Scenario B — 2 human players in the same game
 *
 * Flow:
 *  1. Player 1 creates a game with an open second slot.
 *  2. Player 2 (separate browser context) joins that game.
 *  3. Player 1 (host) starts the game.
 *  4. Both players reach the in-game view with distinct identities.
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/player';
import { openLobby, waitForConnected, createGame, selectGameByName, joinGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, waitForGameOptions, OpponentType } from '../helpers/gameOptions';
import { waitForGameView, assertNoDesyncError } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';

test.beforeEach(async () => {
	await cleanupTestData();
});

test.afterEach(async () => {
	await cleanupTestData();
});

test('two human players create, join, and both reach in-game view', async ({
	playerOne,
	playerTwo,
}) => {
	const gameName = testGameName('scenarioB');

	// --- Player 1: create game ---
	await openLobby(playerOne.page);
	await waitForConnected(playerOne.page);
	await createGame(playerOne.page, playerOne.name);

	// Set the game name.
	const gameNameInput = playerOne.page.locator('[data-testid="game-name-input"]');
	if (await gameNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await gameNameInput.fill(gameName);
		await gameNameInput.blur();
	}

	// Keep slot 1 as Open so player 2 can join.
	await setOpponentSlot(playerOne.page, 1, OpponentType.OPEN);

	// --- Player 2: join the game ---
	await openLobby(playerTwo.page);
	await waitForConnected(playerTwo.page);
	await selectGameByName(playerTwo.page, gameName);
	await joinGame(playerTwo.page, playerTwo.name);
	await waitForGameOptions(playerTwo.page);

	// --- Player 1 (host): start the game ---
	await startGame(playerOne.page);

	// --- Both players should reach the in-game view ---
	await Promise.all([
		waitForGameView(playerOne.page),
		waitForGameView(playerTwo.page),
	]);

	await expect(playerOne.page.locator('[data-testid="view-game"]')).toBeVisible();
	await expect(playerTwo.page.locator('[data-testid="view-game"]')).toBeVisible();

	await assertNoDesyncError(playerOne.page);
	await assertNoDesyncError(playerTwo.page);
});
