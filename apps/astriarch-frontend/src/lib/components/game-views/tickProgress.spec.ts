import { describe, it, expect } from 'vitest';
import type { PlanetProductionItemData } from 'astriarch-engine';
import {
	MS_PER_TICK,
	PlanetImprovementType,
	PlanetProductionItem,
	StarShipType
} from 'astriarch-engine';
import {
	buildBarKey,
	buildBarVariant,
	parseBuildBarVariant,
	progressBarStyle,
	tickProgress
} from './tickProgress';

const SLIDE = `transform ${MS_PER_TICK}ms linear`;

describe('progressBarStyle (scalex)', () => {
	it('snaps on first render', () => {
		expect(progressBarStyle(null, { fraction: 0.3, key: 'a' })).toEqual({
			width: '100%',
			transform: 'scaleX(0.3)',
			transition: 'none',
			borderRadius: ''
		});
	});

	it('slides forward on the same key', () => {
		const style = progressBarStyle({ fraction: 0.3, key: 'a' }, { fraction: 0.35, key: 'a' });
		expect(style.transform).toBe('scaleX(0.35)');
		expect(style.transition).toBe(SLIDE);
	});

	it('keeps sliding when progress is unchanged', () => {
		const style = progressBarStyle({ fraction: 0.3, key: 'a' }, { fraction: 0.3, key: 'a' });
		expect(style.transition).toBe(SLIDE);
	});

	it('snaps when progress goes down (the next item moved up)', () => {
		const style = progressBarStyle({ fraction: 0.98, key: 'a' }, { fraction: 0.02, key: 'a' });
		expect(style.transform).toBe('scaleX(0.02)');
		expect(style.transition).toBe('none');
	});

	it('snaps on a key change, even forward', () => {
		const style = progressBarStyle({ fraction: 0.1, key: 'a' }, { fraction: 0.6, key: 'b' });
		expect(style.transition).toBe('none');
	});

	it('clamps the fraction to 0..1', () => {
		expect(progressBarStyle(null, { fraction: 1.4, key: 'a' }).transform).toBe('scaleX(1)');
		expect(progressBarStyle(null, { fraction: -0.2, key: 'a' }).transform).toBe('scaleX(0)');
		expect(progressBarStyle(null, { fraction: NaN, key: 'a' }).transform).toBe('scaleX(0)');
		// Over 1 then 1 again is not a decrease
		const style = progressBarStyle({ fraction: 1.4, key: 'a' }, { fraction: 1, key: 'a' });
		expect(style.transition).toBe(SLIDE);
	});
});

describe('progressBarStyle (benchmark variants)', () => {
	it('width: the old width transition, always sliding', () => {
		expect(
			progressBarStyle({ fraction: 0.9, key: 'a' }, { fraction: 0.1, key: 'a' }, 'width')
		).toEqual({
			width: '10%',
			transform: '',
			transition: `width ${MS_PER_TICK}ms linear`,
			borderRadius: '9999px'
		});
	});

	it('none: steps at the tick with no transition', () => {
		expect(
			progressBarStyle({ fraction: 0.1, key: 'a' }, { fraction: 0.25, key: 'a' }, 'none')
		).toEqual({ width: '25%', transform: '', transition: 'none', borderRadius: '9999px' });
	});
});

describe('parseBuildBarVariant', () => {
	it('accepts the known variants and defaults to scalex', () => {
		expect(parseBuildBarVariant('width')).toBe('width');
		expect(parseBuildBarVariant('none')).toBe('none');
		expect(parseBuildBarVariant('scalex')).toBe('scalex');
		expect(parseBuildBarVariant(null)).toBe('scalex');
		expect(parseBuildBarVariant('bogus')).toBe('scalex');
	});

	it('is scalex without perf instrumentation', () => {
		expect(buildBarVariant).toBe('scalex');
	});
});

describe('buildBarKey', () => {
	const factory = () =>
		PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);

	it('is the same for the same planet and item kind', () => {
		expect(buildBarKey(1, factory())).toBe(buildBarKey(1, factory()));
	});

	it('differs by planet and by item', () => {
		const scout = PlanetProductionItem.constructStarShipInProduction(StarShipType.Scout);
		expect(buildBarKey(1, factory())).not.toBe(buildBarKey(2, factory()));
		expect(buildBarKey(1, factory())).not.toBe(buildBarKey(1, scout));
		const mine = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Mine);
		expect(buildBarKey(1, factory())).not.toBe(buildBarKey(1, mine));
	});

	it('ignores progress, which changes every tick', () => {
		const item: PlanetProductionItemData = { ...factory(), productionCostComplete: 5 };
		expect(buildBarKey(1, item)).toBe(buildBarKey(1, factory()));
	});
});

describe('tickProgress action', () => {
	function fakeNode() {
		const attrs = new Map<string, string>();
		return {
			style: {} as Record<string, string>,
			attrs,
			setAttribute: (name: string, value: string) => attrs.set(name, value)
		};
	}

	it('applies the style on create and update, sliding only forward', () => {
		const node = fakeNode();
		const action = tickProgress(node as unknown as HTMLElement, { fraction: 0.2, key: 'a' });
		expect(node.attrs.get('data-build-bar')).toBe('scalex');
		expect(node.style).toMatchObject({ transform: 'scaleX(0.2)', transition: 'none' });

		action.update({ fraction: 0.3, key: 'a' });
		expect(node.style).toMatchObject({ transform: 'scaleX(0.3)', transition: SLIDE });

		action.update({ fraction: 0.05, key: 'a' });
		expect(node.style).toMatchObject({ transform: 'scaleX(0.05)', transition: 'none' });
	});

	it('uses the given variant', () => {
		const node = fakeNode();
		tickProgress(node as unknown as HTMLElement, { fraction: 0.5, key: 'a' }, 'none');
		expect(node.attrs.get('data-build-bar')).toBe('none');
		expect(node.style).toMatchObject({ width: '50%', transition: 'none' });
	});
});
