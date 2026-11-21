#!/usr/bin/env node
/**
 * Compare two perf result files.
 *
 *   pnpm --filter astriarch-frontend perf:compare <base> <head> [--all]
 *
 * <base>/<head> are paths to JSON files, or names inside perf-results/ with or
 * without ".json" (e.g. `3d2ada9-firefox`).
 *
 * A change is reported as significant only when the min–max ranges of the two
 * runs do not overlap, i.e. it is larger than the run-to-run noise either side
 * measured. Everything else is "~" (within noise). By default only headline
 * metrics and significant changes are printed; --all prints every metric.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RESULTS_DIR = path.resolve(import.meta.dirname, '../../perf-results');

/** Metrics where a higher value is better. Everything else: lower is better. */
const HIGHER_IS_BETTER = [/^frames\.fps$/];

const HEADLINE = [
	'cpu.totalPct',
	'frames.fps',
	'frames.p95Ms',
	'konva.nodesCreatedPerSec',
	'rate.store.clientGameModel.set',
	'time.canvas.updateGameObjects.msPerSec',
	'time.engine.advanceClientGameModelTime.msPerSec',
	'time.store.clientGameModel.fanout.msPerSec'
];

function resolveFile(arg) {
	if (existsSync(arg)) return arg;
	const name = arg.endsWith('.json') ? arg : `${arg}.json`;
	const candidate = path.join(RESULTS_DIR, name);
	if (existsSync(candidate)) return candidate;
	throw new Error(`Result file not found: ${arg} (also tried ${candidate})`);
}

function load(arg) {
	const file = resolveFile(arg);
	return { file, data: JSON.parse(readFileSync(file, 'utf8')) };
}

function fmt(n) {
	if (n === undefined) return '—';
	if (Math.abs(n) >= 100) return n.toFixed(0);
	if (Math.abs(n) >= 10) return n.toFixed(1);
	return n.toFixed(2);
}

export function compareMetric(name, base, head) {
	if (!base || !head) {
		return { name, base, head, verdict: base ? 'removed' : 'added' };
	}
	const delta = head.median - base.median;
	const pct =
		base.median !== 0 ? (delta / Math.abs(base.median)) * 100 : head.median === 0 ? 0 : Infinity;
	const overlap = head.min <= base.max && base.min <= head.max;
	let verdict = '~';
	if (!overlap) {
		const higherBetter = HIGHER_IS_BETTER.some((re) => re.test(name));
		const improved = higherBetter ? delta > 0 : delta < 0;
		verdict = improved ? 'better' : 'worse';
	}
	return { name, base, head, delta, pct, verdict };
}

function main() {
	const args = process.argv.slice(2);
	const showAll = args.includes('--all');
	const files = args.filter((a) => !a.startsWith('--'));
	if (files.length !== 2) {
		console.error('Usage: perf:compare <base> <head> [--all]');
		process.exit(2);
	}
	const base = load(files[0]);
	const head = load(files[1]);

	console.log(`base: ${base.file}\n      ${describe(base.data.meta)}`);
	console.log(`head: ${head.file}\n      ${describe(head.data.meta)}`);

	for (const warning of metaMismatches(base.data.meta, head.data.meta)) {
		console.warn(`WARNING: ${warning}`);
	}

	let worse = 0;
	let better = 0;
	const windows = new Set([...Object.keys(base.data.windows), ...Object.keys(head.data.windows)]);
	for (const win of windows) {
		const b = base.data.windows[win]?.summary ?? {};
		const h = head.data.windows[win]?.summary ?? {};
		const names = [...new Set([...Object.keys(b), ...Object.keys(h)])].sort();
		const rows = names
			.map((n) => compareMetric(n, b[n], h[n]))
			.filter(
				(r) =>
					showAll || HEADLINE.includes(r.name) || r.verdict === 'better' || r.verdict === 'worse'
			);

		console.log(`\n${win}`);
		console.log(
			`  ${'metric'.padEnd(52)} ${'base'.padStart(9)} ${'head'.padStart(9)} ${'change'.padStart(9)}  verdict`
		);
		for (const r of rows) {
			if (r.verdict === 'better') better++;
			if (r.verdict === 'worse') worse++;
			const change =
				r.pct === undefined
					? ''
					: Number.isFinite(r.pct)
						? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(0)}%`
						: 'new';
			const range = (s) => (s ? ` [${fmt(s.min)}–${fmt(s.max)}]` : '');
			console.log(
				`  ${r.name.padEnd(52)} ${fmt(r.base?.median).padStart(9)} ${fmt(r.head?.median).padStart(9)} ${change.padStart(9)}  ${r.verdict}` +
					(r.verdict === '~' || showAll ? `${range(r.base)} →${range(r.head)}` : '')
			);
		}
	}
	console.log(
		`\n${better} significantly better, ${worse} significantly worse (ranges do not overlap).`
	);
}

/** Run settings that must match for two result files to be comparable. */
const COMPARED_META_KEYS = [
	'browser',
	'cpuModel',
	'platform',
	'galaxySeed',
	'windowMs',
	'warmupMs',
	'repetitions',
	'devicePixelRatio',
	'refreshHz'
];

/** Measured values that only differ meaningfully beyond this relative tolerance. */
const META_TOLERANCE = { refreshHz: 0.1 };

/**
 * Returns one warning per run setting that differs between two result files.
 * Schema v1 files lack devicePixelRatio and refreshHz; a field missing on one
 * side is reported as "not recorded" rather than as a difference.
 */
export function metaMismatches(baseMeta, headMeta) {
	const warnings = [];
	for (const key of COMPARED_META_KEYS) {
		const b = baseMeta[key];
		const h = headMeta[key];
		const bMissing = b === undefined || b === null;
		const hMissing = h === undefined || h === null;
		if (bMissing || hMissing) {
			if (bMissing && hMissing) continue;
			warnings.push(
				`${key} not recorded in ${bMissing ? 'base' : 'head'} (${bMissing ? h : b} in ${bMissing ? 'head' : 'base'}); cannot check it is comparable`
			);
			continue;
		}
		const tolerance = META_TOLERANCE[key];
		const differs = tolerance !== undefined ? Math.abs(h - b) > Math.abs(b) * tolerance : b !== h;
		if (differs) {
			warnings.push(`${key} differs (${b} vs ${h}); results may not be comparable`);
		}
	}
	if (JSON.stringify(baseMeta.viewport) !== JSON.stringify(headMeta.viewport)) {
		warnings.push('viewport differs; results may not be comparable');
	}
	return warnings;
}

function describe(meta) {
	const display =
		meta.refreshHz != null
			? `, ${meta.refreshHz}Hz @${meta.devicePixelRatio}x`
			: ', refresh rate not recorded';
	return `${meta.browser} ${meta.browserVersion}, ${meta.gitSha}${meta.gitDirty ? ' (dirty)' : ''} on ${meta.gitBranch}, ${meta.repetitions}×${meta.windowMs / 1000}s${display}, ${meta.date}`;
}

// Run only as a script, so the spec can import the helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
