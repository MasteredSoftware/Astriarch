import { describe, it, expect } from 'vitest';
import type { PlanetProductionItemData } from 'astriarch-engine';
import {
	MS_PER_TICK,
	PlanetImprovementType,
	PlanetProductionItem,
	StarShipType
} from 'astriarch-engine';
import { buildBarKey, progressBarStyle, tickProgress } from './tickProgress';

const SLIDE = `transform ${MS_PER_TICK}ms linear`;

describe('progressBarStyle', () => {
	it('snaps on first render', () => {
		expect(progressBarStyle(null, { fraction: 0.3, key: 'a' })).toEqual({
			transform: 'scaleX(0.3)',
			transition: 'none'
		});
	});

	it('slides forward over one tick on the same key', () => {
		const style = progressBarStyle({ fraction: 0.3, key: 'a' }, { fraction: 0.35, key: 'a' });
		expect(style).toEqual({ transform: 'scaleX(0.35)', transition: SLIDE });
	});

	it('keeps sliding when progress is unchanged', () => {
		const style = progressBarStyle({ fraction: 0.3, key: 'a' }, { fraction: 0.3, key: 'a' });
		expect(style.transition).toBe(SLIDE);
	});

	it('snaps when progress goes down (the next item moved up)', () => {
		const style = progressBarStyle({ fraction: 0.98, key: 'a' }, { fraction: 0.02, key: 'a' });
		expect(style).toEqual({ transform: 'scaleX(0.02)', transition: 'none' });
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
	it('applies the style on create and update, sliding only forward', () => {
		const node = { style: { transform: '', transition: '' } };
		const action = tickProgress(node as unknown as HTMLElement, { fraction: 0.2, key: 'a' });
		expect(node.style).toEqual({ transform: 'scaleX(0.2)', transition: 'none' });

		action.update({ fraction: 0.3, key: 'a' });
		expect(node.style).toEqual({ transform: 'scaleX(0.3)', transition: SLIDE });

		action.update({ fraction: 0.05, key: 'a' });
		expect(node.style).toEqual({ transform: 'scaleX(0.05)', transition: 'none' });

		action.update({ fraction: 0.5, key: 'b' });
		expect(node.style).toEqual({ transform: 'scaleX(0.5)', transition: 'none' });
	});
});
