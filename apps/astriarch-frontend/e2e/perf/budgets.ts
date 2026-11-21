/**
 * Deterministic perf budgets: the Phase 2 targets from
 * performance_improvements_plan.md ("when nothing changes, nothing runs").
 *
 * These are counters, not timings, so they do not depend on machine speed and
 * are suitable as hard checks (CI included) once Phase 2 meets them. Until
 * then they are report-only; set PERF_ENFORCE_BUDGETS=1 to fail the run on a
 * violation.
 *
 * A metric that was never recorded counts as 0 (e.g. once a loop is removed
 * its counter disappears, which satisfies a `max: 0` budget).
 */

import type { WindowName } from './results';

export interface Budget {
	metric: string;
	max: number;
	why: string;
}

export const budgets: Partial<Record<WindowName, Budget[]>> = {
	idle: [
		{
			metric: 'konva.nodesCreatedPerSec',
			max: 0,
			why: 'No Konva nodes should be created when nothing changes'
		},
		{
			metric: 'konva.nodesDestroyedPerSec',
			max: 0,
			why: 'No Konva nodes should be destroyed when nothing changes'
		},
		{
			metric: 'rate.canvas.update',
			max: 6,
			why: 'The canvas updates only when the model changes (the 5/s model tick plus the odd server update), never per frame'
		},
		{
			metric: 'rate.store.clientGameModel.set',
			max: 6,
			why: 'The model should advance at the fixed tick (MS_PER_TICK = 200ms, 5/s) plus the odd server update, not every frame'
		},
		{
			metric: 'rate.fleetAnimation.frame',
			max: 0,
			why: 'The fleet animation runs only while fleets are in transit'
		},
		{
			metric: 'rate.konva.draw.galaxy',
			max: 1,
			why: 'The galaxy layer should redraw only when planet visuals change'
		},
		{
			metric: 'rate.konva.draw.fleet',
			max: 0,
			why: 'With no fleets in transit the fleet layer should not redraw'
		},
		{ metric: 'rate.konva.draw.ui', max: 0, why: 'The UI layer should redraw only on interaction' },
		{
			metric: 'dom.runningAnimations',
			max: 0,
			why: 'No CSS/Web animation should loop at idle: it makes the browser composite every frame (see snapshot.runningAnimations for which)'
		}
	],
	fleets: [
		{
			metric: 'konva.nodesCreatedPerSec',
			max: 1,
			why: 'Moving fleets should be updated in place, not recreated'
		}
	]
};

export interface BudgetResult extends Budget {
	value: number;
	pass: boolean;
}

export function checkBudgets(
	window: WindowName,
	summary: Record<string, { median: number }>
): BudgetResult[] {
	return (budgets[window] ?? []).map((b) => {
		const value = summary[b.metric]?.median ?? 0;
		return { ...b, value, pass: value <= b.max };
	});
}
