/**
 * Player storage utilities for persisting player preferences in localStorage
 * Following the pattern of the old Astriarch game
 */

const STORAGE_KEYS = {
	PLAYER_NAME: 'astriarch_player_name'
} as const;

export class PlayerStorage {
	/**
	 * Get the stored player name from localStorage
	 * @returns The stored player name or null if not found
	 */
	static getPlayerName(): string | null {
		if (typeof window === 'undefined') {
			// SSR safety - return null on server
			return null;
		}

		try {
			return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
		} catch (error) {
			console.warn('Failed to read player name from localStorage:', error);
			return null;
		}
	}

	/**
	 * Store the player name in localStorage
	 * @param playerName The player name to store
	 */
	static setPlayerName(playerName: string): void {
		if (typeof window === 'undefined') {
			// SSR safety - do nothing on server
			return;
		}

		if (!playerName || playerName.trim().length === 0) {
			// Don't store empty names
			return;
		}

		try {
			localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, playerName.trim());
		} catch (error) {
			console.warn('Failed to save player name to localStorage:', error);
		}
	}

	/**
	 * Clear the stored player name from localStorage
	 */
	static clearPlayerName(): void {
		if (typeof window === 'undefined') {
			// SSR safety - do nothing on server
			return;
		}

		try {
			localStorage.removeItem(STORAGE_KEYS.PLAYER_NAME);
		} catch (error) {
			console.warn('Failed to clear player name from localStorage:', error);
		}
	}

	/**
	 * Get the default player name with localStorage fallback
	 * @param fallback The fallback name if no stored name exists
	 * @returns The stored player name or the fallback
	 */
	static getPlayerNameWithFallback(fallback: string = 'Player'): string {
		return PlayerStorage.getPlayerName() || fallback;
	}
}
