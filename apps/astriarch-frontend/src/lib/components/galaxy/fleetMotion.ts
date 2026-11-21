import type { GameSpeed, PlayerData } from 'astriarch-engine';
import { Fleet, GameController, MS_PER_TICK } from 'astriarch-engine';

/**
 * Extrapolate at most this far past the last model update, so a late or missed
 * tick never carries a fleet much beyond where the model last put it.
 */
export const MAX_EXTRAPOLATION_MS = MS_PER_TICK * 1.5;

/**
 * The speed the engine moves the owner's fleets at, in parsecs per wall-clock
 * ms. The engine moves a fleet by `Fleet.getSpeed(owner) * cyclesElapsed`, where
 * cyclesElapsed is wall time divided by the game speed's ms per cycle.
 */
export function fleetParsecsPerMs(owner: PlayerData, gameSpeed: GameSpeed): number {
	const msPerCycle =
		GameController.GAME_SPEED_MS_PER_CYCLE[gameSpeed] || GameController.MS_PER_CYCLE_DEFAULT;
	return Fleet.getSpeed(owner) / msPerCycle;
}

/**
 * A fleet's position between model updates. The model advances every
 * MS_PER_TICK; in between, the fleet is extrapolated from the last model
 * position at the engine's speed, so it lands where the next tick puts it.
 */
export class FleetMotion {
	private anchorParsecs: number | null = null;
	private anchorTime = 0;
	private parsecsPerMs = 0;

	/**
	 * Records the model's distance to destination. It re-anchors only when the
	 * distance changed (a tick or a server sync), so a repeat value keeps the
	 * extrapolation running. The speed always comes from the caller.
	 */
	record(parsecs: number | null, parsecsPerMs: number, now: number): void {
		this.parsecsPerMs = parsecsPerMs;
		if (parsecs === null) {
			this.anchorParsecs = null;
			return;
		}
		if (parsecs === this.anchorParsecs) return;
		this.anchorParsecs = parsecs;
		this.anchorTime = now;
	}

	/** The extrapolated distance to destination at `now`, or null if unknown. */
	parsecsAt(now: number): number | null {
		if (this.anchorParsecs === null) return null;
		const elapsed = Math.min(Math.max(0, now - this.anchorTime), MAX_EXTRAPOLATION_MS);
		return Math.max(0, this.anchorParsecs - this.parsecsPerMs * elapsed);
	}

	/**
	 * True while parsecsAt() still changes with time: the fleet has distance
	 * left, a speed, and the last model update is recent enough to extrapolate
	 * from. False while the game is paused or the server is late.
	 */
	isMoving(now: number): boolean {
		return (
			this.anchorParsecs !== null &&
			this.anchorParsecs > 0 &&
			this.parsecsPerMs > 0 &&
			now - this.anchorTime < MAX_EXTRAPOLATION_MS
		);
	}
}
