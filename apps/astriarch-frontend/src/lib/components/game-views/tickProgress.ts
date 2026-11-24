import { MS_PER_TICK, type PlanetProductionItemData } from 'astriarch-engine';

/**
 * The build progress bar slides between model ticks with a `transform:
 * scaleX()` CSS transition lasting one tick (MS_PER_TICK), so it moves at a
 * constant rate. The transition keeps the browser compositing every display
 * frame while a build is on screen. In the perf benchmark's `build` window
 * that cost +34 CPU points in Chromium and +17 in Firefox over a bar that
 * steps at the tick; a script-driven bar redrawn 30 times a second still cost
 * +16 / +15 and looked less smooth (performance_improvements_plan.md, Phase 2).
 * Smoothness was judged worth it, and scaleX is the cheapest transition
 * measured (a `width` transition also lays out and paints every frame).
 */

export interface TickProgress {
	/** Completed share, 0..1 (clamped). */
	fraction: number;
	/** What the bar shows (planet and item); a change snaps instead of sliding. */
	key: string;
}

export interface ProgressBarStyle {
	transform: string;
	transition: string;
}

/**
 * The progress bar key for a planet's first build queue item: the planet plus
 * what is being built. Queue items have no id and the model objects are
 * replaced on a server sync, so the key is built from what the bar shows. Two
 * identical items in a row share a key; the second starts lower, which snaps.
 */
export function buildBarKey(planetId: number, item: PlanetProductionItemData): string {
	const what = item.improvementData?.type ?? item.starshipData?.type ?? '';
	const custom = item.starshipData?.customShipData ? 'custom' : '';
	return `${planetId}:${item.itemType}:${what}:${custom}`;
}

function clamp01(n: number): number {
	return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * The bar's inline style when it moves from `prev` (null on first render) to
 * `next`. It slides only forward on the same key; a first render, a decrease
 * (the item finished and the next one started) or a key change (another planet
 * or item) snaps with no transition, so the bar never slides backwards.
 */
export function progressBarStyle(prev: TickProgress | null, next: TickProgress): ProgressBarStyle {
	const fraction = clamp01(next.fraction);
	const forward = prev !== null && prev.key === next.key && fraction >= clamp01(prev.fraction);
	return {
		transform: `scaleX(${fraction})`,
		transition: forward ? `transform ${MS_PER_TICK}ms linear` : 'none'
	};
}

/**
 * Svelte action for the build progress bar: applies progressBarStyle() each
 * time Svelte passes new progress (each model tick). The element should be
 * full width with `transform-origin: left`.
 */
export function tickProgress(node: HTMLElement, progress: TickProgress) {
	let prev: TickProgress | null = null;
	const apply = (next: TickProgress) => {
		const style = progressBarStyle(prev, next);
		node.style.transition = style.transition;
		node.style.transform = style.transform;
		prev = next;
	};
	apply(progress);
	return { update: apply };
}
