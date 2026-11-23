import { MS_PER_TICK, type PlanetProductionItemData } from 'astriarch-engine';
import { perfEnabled } from '#lib/perf/perfMonitor.ts';

/**
 * How the build progress bar animates between model ticks:
 *   none    (default) steps at the 5/s tick, no transition
 *   scalex  `transform: scaleX()` with a MS_PER_TICK linear transition: no
 *           layout or paint per frame, but still composited every frame
 *   width   a `width` transition (the earlier behaviour): layout and paint
 *           every frame while it runs
 * Measured in the perf benchmark's `build` window, any transition keeps the
 * browser compositing every frame while a build is visible: over `none`, scaleX
 * cost +31.5 CPU points in Chromium and +16.9 in Firefox, width +44.6 / +72.5
 * (performance_improvements_plan.md, Phase 2). So the app steps; scalex and
 * width stay selectable for the benchmark only (see buildBarVariant).
 */
export type BuildBarVariant = 'scalex' | 'width' | 'none';

const VARIANTS: readonly BuildBarVariant[] = ['scalex', 'width', 'none'];

export function parseBuildBarVariant(value: unknown): BuildBarVariant {
	return VARIANTS.includes(value as BuildBarVariant) ? (value as BuildBarVariant) : 'none';
}

declare global {
	interface Window {
		/** Perf benchmark only: the build bar variant (PERF_BUILD_BAR). */
		__ASTRIARCH_PERF_BUILD_BAR__?: string;
	}
}

/**
 * The variant in use, read once at load. Only with perf instrumentation on
 * (`?perf=1`) can it be changed, by `window.__ASTRIARCH_PERF_BUILD_BAR__` (set
 * by the benchmark from PERF_BUILD_BAR) or `&perfBuildBar=<variant>` in the URL.
 */
export const buildBarVariant: BuildBarVariant = perfEnabled
	? parseBuildBarVariant(
			window.__ASTRIARCH_PERF_BUILD_BAR__ ??
				new URLSearchParams(window.location.search).get('perfBuildBar')
		)
	: 'none';

export interface TickProgress {
	/** Completed share, 0..1 (clamped). */
	fraction: number;
	/** What the bar shows (planet and item); a change snaps instead of sliding. */
	key: string;
}

export interface ProgressBarStyle {
	width: string;
	transform: string;
	transition: string;
	borderRadius: string;
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
 * `next`. The none variant (the default) sets the width with no transition, so
 * it steps at each tick and never slides backwards. The benchmark-only scalex
 * variant slides only forward on the same key; a first render, a decrease (the
 * item finished and the next one started) or a key change (another planet or
 * item) snaps with no transition. The width variant keeps the old behaviour
 * (always slides).
 */
export function progressBarStyle(
	prev: TickProgress | null,
	next: TickProgress,
	variant: BuildBarVariant = 'none'
): ProgressBarStyle {
	const fraction = clamp01(next.fraction);
	if (variant === 'width' || variant === 'none') {
		return {
			width: `${fraction * 100}%`,
			transform: '',
			transition: variant === 'width' ? `width ${MS_PER_TICK}ms linear` : 'none',
			borderRadius: '9999px'
		};
	}
	const forward = prev !== null && prev.key === next.key && fraction >= clamp01(prev.fraction);
	return {
		width: '100%',
		transform: `scaleX(${fraction})`,
		transition: forward ? `transform ${MS_PER_TICK}ms linear` : 'none',
		borderRadius: ''
	};
}

/**
 * Svelte action for the build progress bar: applies progressBarStyle() on
 * every update. Runs only when Svelte passes new progress (each model tick);
 * with the default none variant the bar steps then, with no animation between.
 */
export function tickProgress(
	node: HTMLElement,
	progress: TickProgress,
	variant: BuildBarVariant = buildBarVariant
) {
	let prev: TickProgress | null = null;
	node.setAttribute('data-build-bar', variant);
	const apply = (next: TickProgress) => {
		const style = progressBarStyle(prev, next, variant);
		node.style.transition = style.transition;
		node.style.width = style.width;
		node.style.transform = style.transform;
		node.style.borderRadius = style.borderRadius;
		prev = next;
	};
	apply(progress);
	return { update: apply };
}
