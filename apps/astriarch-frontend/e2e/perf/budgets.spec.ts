import { describe, it, expect } from 'vitest';
import { checkBudgets, budgets, type Budget } from './budgets';

const list: Budget[] = [
	{ metric: 'a', max: 1, why: 'a' },
	{ metric: 'b', max: 0, why: 'b', absentMeansZero: true }
];

describe('checkBudgets', () => {
	it('passes at or below the max', () => {
		const [a] = checkBudgets('idle', { a: { median: 1 } }, list);
		expect(a).toMatchObject({ value: 1, status: 'pass', pass: true });
	});

	it('fails above the max', () => {
		const [a] = checkBudgets('idle', { a: { median: 1.5 } }, list);
		expect(a).toMatchObject({ value: 1.5, status: 'fail', pass: false });
	});

	it('reports an absent metric as missing, not passing', () => {
		const [a] = checkBudgets('idle', {}, list);
		expect(a).toMatchObject({ value: null, status: 'missing', pass: false });
	});

	it('treats an absent metric as 0 only when the budget opts in', () => {
		const [, b] = checkBudgets('idle', {}, list);
		expect(b).toMatchObject({ value: 0, status: 'pass', pass: true });
		const [, b2] = checkBudgets('idle', { b: { median: 2 } }, list);
		expect(b2).toMatchObject({ value: 2, status: 'fail' });
	});

	it('uses the window budgets by default', () => {
		expect(checkBudgets('idle', {})).toHaveLength(budgets.idle!.length);
		expect(checkBudgets('panzoom', {})).toHaveLength(budgets.panzoom?.length ?? 0);
	});

	it('gives the model-set budget headroom for server pushes', () => {
		const set = budgets.idle!.find((b) => b.metric === 'rate.store.clientGameModel.set');
		expect(set?.max).toBe(6);
		const [r] = checkBudgets('idle', { 'rate.store.clientGameModel.set': { median: 5.1 } }, [set!]);
		expect(r!.status).toBe('pass');
	});
});
