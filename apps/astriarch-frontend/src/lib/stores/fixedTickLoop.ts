export interface FixedTickLoop {
	/** Starts the loop, restarting it if it is already running. */
	start(): void;
	/** Starts the loop only if it isn't running. */
	ensureRunning(): void;
	/** Stops the loop. Safe to call when it isn't running. */
	stop(): void;
	isRunning(): boolean;
}

/**
 * Calls `tick` every `intervalMs` on a timer, not per frame. A tick that
 * returns false stops the loop (for example, when the game is no longer running).
 */
export function createFixedTickLoop(tick: () => boolean, intervalMs: number): FixedTickLoop {
	let timerId: ReturnType<typeof setInterval> | null = null;

	function stop() {
		if (timerId !== null) {
			clearInterval(timerId);
			timerId = null;
		}
	}

	function start() {
		stop();
		timerId = setInterval(() => {
			if (!tick()) stop();
		}, intervalMs);
	}

	return {
		start,
		ensureRunning() {
			if (timerId === null) start();
		},
		stop,
		isRunning: () => timerId !== null
	};
}
