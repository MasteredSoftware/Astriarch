/**
 * In-game helpers — waiting for server acknowledgments and triggering game actions.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const DEFAULT_TIMEOUT = 15_000;

/**
 * Wait for the in-game view to be fully loaded (planet list or galaxy canvas visible).
 */
export async function waitForGameView(page: Page): Promise<void> {
	await page.waitForSelector('[data-testid="view-game"]', { timeout: DEFAULT_TIMEOUT });
}

/**
 * Wait until no error/desync notification is shown.
 * Returns immediately if the notification is already absent.
 */
export async function assertNoDesyncError(page: Page): Promise<void> {
	const errorNotification = page.locator('[data-testid="notification-error"]');
	await expect(errorNotification).toHaveCount(0, { timeout: 5_000 });
	const count = await errorNotification.count();
	if (count > 0) {
		const text = await errorNotification.first().innerText();
		throw new Error(`Unexpected error notification visible: "${text}"`);
	}
}

/**
 * Wait for a COMMAND_ACK to arrive (tracked via DOM attribute set by the store).
 * Falls back to a short wait if the attribute mechanism isn't wired yet.
 */
export async function waitForCommandAck(page: Page, commandId?: string): Promise<void> {
	if (commandId) {
		await page.waitForFunction(
			(id) => {
				const el = document.querySelector(`[data-command-acked="${id}"]`);
				return !!el;
			},
			commandId,
			{ timeout: DEFAULT_TIMEOUT }
		);
	} else {
		await page.waitForSelector('[data-testid="view-game"]', { timeout: DEFAULT_TIMEOUT });
		await expect(page.locator('[data-testid="notification-error"]')).toHaveCount(0, {
			timeout: 5_000
		});
	}
}

/**
 * Send ships via the Fleet Command view UI.
 * Requires the source planet to already be selected in the galaxy canvas.
 */
export async function sendShipsViaUI(page: Page): Promise<void> {
	const sendBtn = page.locator('[data-testid="send-ships-btn"]');
	await sendBtn.waitFor({ timeout: DEFAULT_TIMEOUT });
	await sendBtn.click();
}

/**
 * Navigate to the Fleet Command view tab.
 */
export async function openFleetCommandView(page: Page): Promise<void> {
	// The nav tabs are SVG paths with role="button" and aria-label matching the tab label.
	const fleetTab = page.getByRole('button', { name: 'Fleets' });
	await fleetTab.waitFor({ timeout: DEFAULT_TIMEOUT });
	await fleetTab.click();
}
