/**
 * Scenario E — Main tab hotkeys and key-collision behavior
 *
 * Validates that in-game main tab shortcuts navigate as expected and that
 * gameplay hotkeys remain available (A in Fleet Command).
 */

import { test, expect, type Page } from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';

function getTabButton(page: Page, label: string) {
	return page.getByRole('button', { name: label }).first();
}

function getTabContainer(page: Page, label: string) {
	return getTabButton(page, label).locator(
		'xpath=ancestor::div[contains(@class,"pointer-events-none relative")][1]'
	);
}

async function expectTabSelected(page: Page, selectedLabel: string, unselectedLabels: string[]) {
	await expect(getTabButton(page, selectedLabel)).toHaveAttribute('fill', '#00FFFF');
	for (const label of unselectedLabels) {
		await expect(getTabButton(page, label)).toHaveAttribute('fill', '#1B1F25');
	}
}

test.beforeEach(async () => {
	await cleanupTestData();
});

test.afterEach(async () => {
	await cleanupTestData();
});

test('main tab hotkeys navigate views and preserve fleet select-all on A', async ({ page }) => {
	const gameName = testGameName('scenarioE');

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

	// Verify visual shortcut cue underlines are present on main navigation tabs.
	// Case-insensitive: the DOM holds the label's own letter (e.g. lowercase 'e' in 'Planets'); CSS uppercases it.
	await expect(getTabContainer(page, 'Planets').locator('u')).toHaveText(/^E$/i);
	await expect(getTabContainer(page, 'Fleets').locator('u')).toHaveText(/^F$/i);
	await expect(getTabContainer(page, 'Research').locator('u')).toHaveText(/^R$/i);
	await expect(getTabContainer(page, 'Trading').locator('u')).toHaveText(/^T$/i);
	await expect(getTabContainer(page, 'Activity').locator('u')).toHaveText(/^C$/i);

	await expectTabSelected(page, 'Planets', ['Fleets', 'Research', 'Trading', 'Activity']);

	await page.keyboard.press('f');
	await expect(page.getByText('Send ships from', { exact: false })).toBeVisible({
		timeout: 10_000
	});
	await expectTabSelected(page, 'Fleets', ['Planets', 'Research', 'Trading', 'Activity']);

	// Ensure the fleet gameplay hotkey does not conflict with main-tab navigation.
	await page.keyboard.press('a');
	await expect(page.getByText('Send ships from', { exact: false })).toBeVisible({
		timeout: 10_000
	});
	await expectTabSelected(page, 'Fleets', ['Planets', 'Research', 'Trading', 'Activity']);

	await page.keyboard.press('r');
	await expect(page.getByText('Research improvements', { exact: false })).toBeVisible({
		timeout: 10_000
	});
	await expectTabSelected(page, 'Research', ['Planets', 'Fleets', 'Trading', 'Activity']);

	await page.keyboard.press('t');
	await expect(page.getByText('Trading from', { exact: false })).toBeVisible({ timeout: 10_000 });
	await expectTabSelected(page, 'Trading', ['Planets', 'Fleets', 'Research', 'Activity']);

	await page.keyboard.press('c');
	await expect(page.getByText('Activity Center', { exact: false })).toBeVisible({
		timeout: 10_000
	});
	await expectTabSelected(page, 'Activity', ['Planets', 'Fleets', 'Research', 'Trading']);

	await page.keyboard.press('e');
	await expect(page.getByText('Build Items', { exact: false })).toBeVisible({ timeout: 10_000 });
	await expectTabSelected(page, 'Planets', ['Fleets', 'Research', 'Trading', 'Activity']);

	// P is Space Platform's build hotkey, not a tab hotkey: it must not switch tabs.
	// (A new game can't afford a Space Platform, so we don't expect it to be queued.)
	await page.keyboard.press('p');
	await expectTabSelected(page, 'Planets', ['Fleets', 'Research', 'Trading', 'Activity']);

	// Remapped build hotkeys still work: Farm moved from R (now Research) to M and is
	// affordable at game start, so pressing M should enqueue it.
	const buildQueueSection = page.locator('div', {
		has: page.getByRole('heading', { name: 'Build Queue' })
	});
	const buildQueueRemoveButtons = buildQueueSection.locator('button', { hasText: '✕' });
	const initialQueueCount = await buildQueueRemoveButtons.count();

	await page.keyboard.press('m');
	await expect
		.poll(async () => await buildQueueRemoveButtons.count(), { timeout: 10_000 })
		.toBe(initialQueueCount + 1);
	await expectTabSelected(page, 'Planets', ['Fleets', 'Research', 'Trading', 'Activity']);
});
