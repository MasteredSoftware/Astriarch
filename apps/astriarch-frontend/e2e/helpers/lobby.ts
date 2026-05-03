/**
 * Lobby helpers — reusable actions for the lobby and game-options screens.
 */

import type { Page } from '@playwright/test';

const DEFAULT_TIMEOUT = 15_000;

/** Navigate to the app root and wait for the lobby to be visible. */
export async function openLobby(page: Page): Promise<void> {
	await page.goto('/');
	// Wait for Vite module graph to finish loading so SvelteKit has hydrated
	// and onclick handlers are attached before we click.
	await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
	// The main page shows a "Play Now" button to enter the multiplayer lobby.
	// Try testid first, fall back to role+name if the testid isn't in the DOM.
	const lobbyBtn = page
		.locator('[data-testid="show-lobby-btn"]')
		.or(page.getByRole('button', { name: 'Play Now' }));
	await lobbyBtn.waitFor({ timeout: 10_000 });
	await lobbyBtn.click();
	await page.waitForSelector('[data-testid="view-lobby"]', { timeout: DEFAULT_TIMEOUT });
}

/** Wait for the WebSocket connection indicator to show connected. */
export async function waitForConnected(page: Page): Promise<void> {
	// The lobby hides the "Connecting…" banner once connected.
	// We wait until it is gone rather than asserting a positive state,
	// since the connected state is implied by the lobby being interactive.
	await page.waitForFunction(
		() => !document.querySelector('[data-testid="connection-status"]'),
		{ timeout: DEFAULT_TIMEOUT }
	);
}

/** Create a new game and wait for the game-options screen. Returns the page. */
export async function createGame(page: Page, playerName: string): Promise<void> {
	// Set player name via the name input in the lobby header area if visible.
	const nameInput = page.locator('[data-testid="lobby-player-name-input"]');
	if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await nameInput.fill(playerName);
	}

	await page.click('[data-testid="create-game-btn"]');
	await page.waitForSelector('[data-testid="view-game-options"]', { timeout: DEFAULT_TIMEOUT });

	// Fill the player name inside game options if it's there.
	const optionsNameInput = page.locator('[data-testid="player-name-input"]');
	if (await optionsNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await optionsNameInput.fill(playerName);
		await optionsNameInput.blur();
	}
}

/** Select a game from the lobby list by partial name and wait for the details panel. */
export async function selectGameByName(page: Page, partialName: string): Promise<void> {
	const item = page.locator('[data-testid^="game-item-"]', { hasText: partialName });
	await item.waitFor({ timeout: DEFAULT_TIMEOUT });
	await item.click();
}

/** Click Join Game in the details panel. */
export async function joinGame(page: Page, playerName: string): Promise<void> {
	const optionsNameInput = page.locator('[data-testid="player-name-input"]');

	// Fill name if the name input is visible in the details panel
	const detailsNameInput = page.locator('[data-testid="lobby-player-name-input"]');
	if (await detailsNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await detailsNameInput.fill(playerName);
	}

	await page.click('[data-testid="join-game-btn"]');
	await page.waitForSelector('[data-testid="view-game-options"]', { timeout: DEFAULT_TIMEOUT });

	if (await optionsNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await optionsNameInput.fill(playerName);
		await optionsNameInput.blur();
	}
}

/** Click Resume Game in the details panel and wait for the in-game view. */
export async function resumeGame(page: Page): Promise<void> {
	await page.click('[data-testid="resume-game-btn"]');
	await page.waitForSelector('[data-testid="view-game"]', { timeout: DEFAULT_TIMEOUT });
}
