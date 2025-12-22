/**
 * Global keyboard shortcut service for Astriarch
 * Manages game-wide keyboard shortcuts with context and priority support
 */

type ShortcutCallback = (event: KeyboardEvent) => void;

interface ShortcutRegistration {
	key: string;
	callback: ShortcutCallback;
	context?: string;
	priority?: number;
}

class KeyboardShortcutService {
	private shortcuts: Map<string, ShortcutRegistration[]> = new Map();
	private isListening = false;

	/**
	 * Initialize the service and start listening for keyboard events
	 */
	public initialize(): void {
		if (this.isListening) return;

		window.addEventListener('keydown', this.handleKeyDown.bind(this));
		this.isListening = true;
		console.log('Keyboard shortcut service initialized');
	}

	/**
	 * Register a keyboard shortcut
	 * @param key - The key to listen for (e.g., 'n', 'b', 'Escape')
	 * @param callback - Function to call when key is pressed
	 * @param context - Optional context identifier to group related shortcuts
	 * @param priority - Optional priority (higher = executed first), defaults to 0
	 */
	public registerShortcut(
		key: string,
		callback: ShortcutCallback,
		context?: string,
		priority: number = 0
	): void {
		const normalizedKey = key.toLowerCase();

		if (!this.shortcuts.has(normalizedKey)) {
			this.shortcuts.set(normalizedKey, []);
		}

		const registrations = this.shortcuts.get(normalizedKey)!;
		registrations.push({ key: normalizedKey, callback, context, priority });

		// Sort by priority (highest first)
		registrations.sort((a, b) => (b.priority || 0) - (a.priority || 0));

		console.log(`Registered shortcut: ${key}${context ? ` (context: ${context})` : ''}`);
	}

	/**
	 * Unregister a keyboard shortcut
	 * @param key - The key to unregister
	 * @param context - Optional context to only remove shortcuts from that context
	 */
	public unregisterShortcut(key: string, context?: string): void {
		const normalizedKey = key.toLowerCase();

		if (!this.shortcuts.has(normalizedKey)) return;

		const registrations = this.shortcuts.get(normalizedKey)!;

		if (context) {
			// Remove only shortcuts with matching context
			const filtered = registrations.filter((reg) => reg.context !== context);
			if (filtered.length > 0) {
				this.shortcuts.set(normalizedKey, filtered);
			} else {
				this.shortcuts.delete(normalizedKey);
			}
			console.log(`Unregistered shortcut: ${key} (context: ${context})`);
		} else {
			// Remove all shortcuts for this key
			this.shortcuts.delete(normalizedKey);
			console.log(`Unregistered all shortcuts for: ${key}`);
		}
	}

	/**
	 * Unregister all shortcuts for a given context
	 * @param context - The context identifier
	 */
	public unregisterContext(context: string): void {
		for (const [key, registrations] of this.shortcuts.entries()) {
			const filtered = registrations.filter((reg) => reg.context !== context);
			if (filtered.length > 0) {
				this.shortcuts.set(key, filtered);
			} else {
				this.shortcuts.delete(key);
			}
		}
		console.log(`Unregistered all shortcuts for context: ${context}`);
	}

	/**
	 * Handle keydown events
	 */
	private handleKeyDown(event: KeyboardEvent): void {
		// Ignore shortcuts when typing in input fields
		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		const key = event.key.toLowerCase();

		if (!this.shortcuts.has(key)) return;

		const registrations = this.shortcuts.get(key)!;

		// Execute callbacks in priority order
		// Stop if any callback prevents default
		for (const registration of registrations) {
			try {
				registration.callback(event);

				// If the event was prevented, stop executing other handlers
				if (event.defaultPrevented) {
					break;
				}
			} catch (error) {
				console.error(`Error executing shortcut callback for key "${key}":`, error);
			}
		}
	}

	/**
	 * Cleanup and stop listening
	 */
	public destroy(): void {
		if (!this.isListening) return;

		window.removeEventListener('keydown', this.handleKeyDown.bind(this));
		this.shortcuts.clear();
		this.isListening = false;
		console.log('Keyboard shortcut service destroyed');
	}

	/**
	 * Get all registered shortcuts (for debugging)
	 */
	public getRegisteredShortcuts(): Map<string, ShortcutRegistration[]> {
		return new Map(this.shortcuts);
	}
}

// Export singleton instance
export const keyboardShortcutService = new KeyboardShortcutService();
