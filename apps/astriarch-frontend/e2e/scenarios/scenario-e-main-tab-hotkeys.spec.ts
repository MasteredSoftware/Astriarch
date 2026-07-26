/**
 * Scenario E — Main tab hotkeys and key-collision behavior
 *
 * Validates that in-game main tab shortcuts navigate as expected and that
 * gameplay hotkeys remain available (A in Fleet Command).
 */

import { test, expect } from '@playwright/test';
import { openLobby, waitForConnected, createGame } from '../helpers/lobby';
import { setOpponentSlot, startGame, OpponentType } from '../helpers/gameOptions';
import { waitForGameView } from '../helpers/inGame';
import { cleanupTestData, testGameName } from '../helpers/cleanup';

function getTabButton(page: Parameters<typeof test>[0]['page'], label: string) {
	return page.getByRole('button', { name: label }).first();
}

function getTabContainer(page: Parameters<typeof test>[0]['page'], label: string) {
	return getTabButton(page, label).locator(
		'xpath=ancestor::div[contains(@class,"pointer-events-none relative")][1]'
	);
}

async function expectTabSelected(
	page: Parameters<typeof test>[0]['page'],
	selectedLabel: string,
	unselectedLabels: string[]
) {
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
	await expect(getTabContainer(page, 'Planets').locator('u')).toHaveText('P');
	await expect(getTabContainer(page, 'Fleets').locator('u')).toHaveText('F');
	await expect(getTabContainer(page, 'Research').locator('u')).toHaveText('R');
	await expect(getTabContainer(page, 'Trading').locator('u')).toHaveText('T');
	await expect(getTabContainer(page, 'Activity').locator('u')).toHaveText('I');

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

	await page.keyboard.press('i');
	await expect(page.getByText('Activity Center', { exact: false })).toBeVisible({
		timeout: 10_000
	});
	await expectTabSelected(page, 'Activity', ['Planets', 'Fleets', 'Research', 'Trading']);

	await page.keyboard.press('p');
	await expect(page.getByText('Build Items', { exact: false })).toBeVisible({ timeout: 10_000 });
	await expectTabSelected(page, 'Planets', ['Fleets', 'Research', 'Trading', 'Activity']);

	// Space Platform is remapped to X; pressing X should enqueue it in the build queue.
	const buildQueueSection = page.locator('div', {
		has: page.getByRole('heading', { name: 'Build Queue' })
	});
	const buildQueueRemoveButtons = buildQueueSection.locator('button', { hasText: '✕' });
	const initialQueueCount = await buildQueueRemoveButtons.count();

	await page.keyboard.press('x');
	await expect
		.poll(async () => await buildQueueRemoveButtons.count(), { timeout: 10_000 })
		.toBe(initialQueueCount + 1);
	await expect(page.getByText('Space Platform', { exact: false })).toBeVisible({ timeout: 10_000 });
});
