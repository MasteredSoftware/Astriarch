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
});
