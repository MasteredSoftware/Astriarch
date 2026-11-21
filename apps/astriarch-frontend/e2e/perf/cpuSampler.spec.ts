import { describe, it, expect } from 'vitest';
import {
	parsePsTime,
	classifyProcess,
	cpuDelta,
	type ProcessCpu,
	type TreeSample
} from './cpuSampler';

describe('parsePsTime', () => {
	it('parses mm:ss.ff', () => {
		expect(parsePsTime('0:01.50')).toBeCloseTo(1.5);
		expect(parsePsTime('12:03.25')).toBeCloseTo(723.25);
	});

	it('parses hh:mm:ss', () => {
		expect(parsePsTime('1:02:03')).toBe(3723);
	});

	it('parses dd-hh:mm:ss and trims whitespace', () => {
		expect(parsePsTime(' 2-01:00:00 ')).toBe(2 * 86400 + 3600);
	});
});

describe('classifyProcess', () => {
	it('classifies Chromium helpers by --type', () => {
		expect(classifyProcess('/chrome --type=renderer --foo')).toBe('renderer');
		expect(classifyProcess('/chrome --type=gpu-process')).toBe('gpu');
		expect(classifyProcess('/chrome --type=utility --utility-sub-type=network')).toBe('utility');
		expect(classifyProcess('/chrome --type=zygote')).toBe('zygote');
	});

	it('classifies Linux Firefox -contentproc children', () => {
		expect(classifyProcess('/usr/lib/firefox/firefox -contentproc -isForBrowser 1 tab')).toBe(
			'content'
		);
		expect(classifyProcess('/usr/lib/firefox/firefox -contentproc 2 gpu')).toBe('gpu');
		expect(classifyProcess('/usr/lib/firefox/firefox -contentproc 3 something')).toBe('child');
	});

	it('classifies macOS Firefox plugin-container children', () => {
		const base =
			'/Applications/Firefox.app/Contents/MacOS/plugin-container.app/Contents/MacOS/plugin-container -isForBrowser 1';
		expect(classifyProcess(`${base} tab`)).toBe('content');
		expect(classifyProcess(`${base} gpu`)).toBe('gpu');
		expect(classifyProcess(`${base} rdd`)).toBe('rdd');
	});

	it('defaults to main', () => {
		expect(classifyProcess('/Applications/Firefox.app/Contents/MacOS/firefox -foreground')).toBe(
			'main'
		);
	});
});

function sample(takenAt: number, procs: ProcessCpu[]): TreeSample {
	return { takenAt, processes: new Map(procs.map((p) => [p.pid, p])) };
}

describe('cpuDelta', () => {
	it('sums CPU per role as % of one core', () => {
		const start = sample(0, [
			{ pid: 1, ppid: 0, cpuSec: 1, role: 'main' },
			{ pid: 2, ppid: 1, cpuSec: 2, role: 'renderer' }
		]);
		const end = sample(2000, [
			{ pid: 1, ppid: 0, cpuSec: 1.5, role: 'main' },
			{ pid: 2, ppid: 1, cpuSec: 3, role: 'renderer' }
		]);
		const d = cpuDelta(start, end);
		expect(d.wallSec).toBe(2);
		expect(d.cpuSec).toBeCloseTo(1.5);
		expect(d.totalPct).toBe(75);
		expect(d.byRolePct).toEqual({ main: 25, renderer: 50 });
		expect(d.processCount).toBe(2);
		expect(d.exitedProcesses).toBe(0);
	});

	it('counts a new process from zero and reports exited ones', () => {
		const start = sample(0, [
			{ pid: 1, ppid: 0, cpuSec: 1, role: 'main' },
			{ pid: 2, ppid: 1, cpuSec: 5, role: 'gpu' }
		]);
		const end = sample(1000, [
			{ pid: 1, ppid: 0, cpuSec: 1.1, role: 'main' },
			{ pid: 3, ppid: 1, cpuSec: 0.2, role: 'renderer' }
		]);
		const d = cpuDelta(start, end);
		expect(d.totalPct).toBeCloseTo(30);
		expect(d.byRolePct.renderer).toBe(20);
		expect(d.byRolePct.gpu).toBeUndefined();
		expect(d.exitedProcesses).toBe(1);
	});
});
