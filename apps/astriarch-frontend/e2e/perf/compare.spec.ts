import { describe, it, expect } from 'vitest';
import { compareMetric, metaMismatches } from './compare.mjs';

const s = (median: number, min = median, max = median) => ({ median, min, max, n: 3 });

describe('compareMetric', () => {
	it('reports overlapping ranges as within noise', () => {
		const r = compareMetric('cpu.totalPct', s(10, 8, 12), s(11, 9, 13));
		expect(r.verdict).toBe('~');
		expect(r.delta).toBe(1);
		expect(r.pct).toBeCloseTo(10);
	});

	it('treats lower as better by default', () => {
		expect(compareMetric('cpu.totalPct', s(10, 9, 11), s(5, 4, 6)).verdict).toBe('better');
		expect(compareMetric('cpu.totalPct', s(5, 4, 6), s(10, 9, 11)).verdict).toBe('worse');
	});

	it('treats higher fps as better', () => {
		expect(compareMetric('frames.fps', s(30, 29, 31), s(60, 59, 61)).verdict).toBe('better');
		expect(compareMetric('frames.fps', s(60, 59, 61), s(30, 29, 31)).verdict).toBe('worse');
	});

	it('reports added and removed metrics', () => {
		expect(compareMetric('x', undefined, s(1)).verdict).toBe('added');
		expect(compareMetric('x', s(1), undefined).verdict).toBe('removed');
	});

	it('reports a change from zero as infinite pct', () => {
		expect(compareMetric('x', s(0), s(2)).pct).toBe(Infinity);
		expect(compareMetric('x', s(0), s(0)).pct).toBe(0);
	});
});

describe('metaMismatches', () => {
	const meta = {
		browser: 'chromium',
		cpuModel: 'Apple M1',
		platform: 'darwin-arm64',
		galaxySeed: 1,
		windowMs: 20000,
		viewport: { width: 1440, height: 900 }
	};

	it('returns nothing for matching metadata', () => {
		expect(metaMismatches(meta, { ...meta })).toEqual([]);
	});

	it('warns for each differing setting and the viewport', () => {
		const warnings = metaMismatches(meta, {
			...meta,
			browser: 'firefox',
			viewport: { width: 800, height: 600 }
		});
		expect(warnings).toHaveLength(2);
		expect(warnings[0]).toMatch(/^browser differs \(chromium vs firefox\)/);
		expect(warnings[1]).toMatch(/^viewport differs/);
	});

	const v2 = { ...meta, warmupMs: 10000, repetitions: 5, devicePixelRatio: 2, refreshHz: 120 };

	it('compares warmup, repetitions, devicePixelRatio and refresh rate', () => {
		const warnings = metaMismatches(v2, {
			...v2,
			warmupMs: 3000,
			repetitions: 1,
			devicePixelRatio: 1,
			refreshHz: 60
		});
		expect(warnings).toEqual([
			'warmupMs differs (10000 vs 3000); results may not be comparable',
			'repetitions differs (5 vs 1); results may not be comparable',
			'devicePixelRatio differs (2 vs 1); results may not be comparable',
			'refreshHz differs (120 vs 60); results may not be comparable'
		]);
	});

	it('tolerates small refresh rate measurement differences', () => {
		expect(metaMismatches(v2, { ...v2, refreshHz: 119.2 })).toEqual([]);
	});

	it('reports fields missing from a schema v1 file as not recorded', () => {
		const v1 = { ...meta, warmupMs: 10000, repetitions: 5 };
		const warnings = metaMismatches(v1, v2);
		expect(warnings).toEqual([
			'devicePixelRatio not recorded in base (2 in head); cannot check it is comparable',
			'refreshHz not recorded in base (120 in head); cannot check it is comparable'
		]);
		expect(metaMismatches(v1, { ...v1 })).toEqual([]);
	});
});
