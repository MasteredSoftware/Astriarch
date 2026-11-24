/**
 * Deterministic perf budgets: the Phase 2 targets from
 * performance_improvements_plan.md ("when nothing changes, nothing runs").
 *
 * These are counters, not timings, so they do not depend on machine speed and
 * are suitable as hard checks (CI included) once Phase 2 meets them. Until
 * then they are report-only; set PERF_ENFORCE_BUDGETS=1 to fail the run on a
 * violation.
 *
 * A metric that is absent from the results is MISSING, which counts as a
 * violation: a renamed layer or a lost perfRegisterKonvaStage call must not
 * turn a `max: 0` budget green. A budget whose counter legitimately disappears
 * when its work stops (e.g. a rAF loop that is removed) opts in with
 * `absentMeansZero: true`. Konva layer draw counters are reported as explicit
 * zeros for every registered layer, so they need no opt-in.
 */

import type { WindowName } from './results';

export interface Budget {
	metric: string;
	max: number;
	why: string;
	/** Treat an absent metric as 0 instead of MISSING. */
	absentMeansZero?: boolean;
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
			why: 'The fleet animation runs only while fleets are in transit',
			absentMeansZero: true
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
			why: 'No CSS/Web animation with infinite iterations should run for the whole idle window: it makes the browser composite every frame (see snapshot.loopingAnimations for which)'
		},
		{
			metric: 'rate.dom.transitionrun',
			max: 1,
			why: 'No CSS transition should restart on every update (e.g. per 5/s tick) when nothing changes; that animates every frame without looping',
			absentMeansZero: true
		},
		{
			metric: 'rate.dom.animationstart',
			max: 1,
			why: 'No CSS animation (including Svelte transitions) should restart on every update when nothing changes; that animates every frame without looping',
			absentMeansZero: true
		}
	],
	panzoom: [
		{
			metric: 'dom.runningAnimations',
			max: 0,
			why: 'No CSS/Web animation with infinite iterations should run for the whole window (see snapshot.loopingAnimations for which)'
		}
	],
	fleets: [
		{
			metric: 'konva.nodesCreatedPerSec',
			max: 1,
			why: 'Moving fleets should be updated in place, not recreated'
		},
		{
			metric: 'dom.runningAnimations',
			max: 0,
			why: 'No CSS/Web animation with infinite iterations should run for the whole window, e.g. on the open Fleet Command view (see snapshot.loopingAnimations)'
		}
	],
	// The build bar transitions on every tick here, so rate.dom.transitionrun
	// is recorded (and checked by buildProgressWarnings) but not budgeted.
	build: [
		{
			metric: 'dom.runningAnimations',
			max: 0,
			why: 'No CSS/Web animation with infinite iterations should run for the whole window, e.g. on the Planet Overview with a build in progress (see snapshot.loopingAnimations)'
		}
	]
};

export type BudgetStatus = 'pass' | 'fail' | 'missing';

export interface BudgetResult extends Budget {
	/** The median, or null when the metric is MISSING. */
	value: number | null;
	status: BudgetStatus;
	/** status === 'pass'. */
	pass: boolean;
}

export function checkBudgets(
	window: WindowName,
	summary: Record<string, { median: number }>,
	list: Budget[] = budgets[window] ?? []
): BudgetResult[] {
	return list.map((b) => {
		const median = summary[b.metric]?.median;
		const value = median ?? (b.absentMeansZero ? 0 : null);
		const status: BudgetStatus = value === null ? 'missing' : value <= b.max ? 'pass' : 'fail';
		return { ...b, value, status, pass: status === 'pass' };
	});
}
