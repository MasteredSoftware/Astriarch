/**
 * OS-level CPU sampling for a browser's whole process tree.
 *
 * This is the one CPU metric that works the same for Chromium and Firefox
 * (Playwright cannot use Chrome's DevTools protocol on Firefox). It sums the
 * cumulative user+system CPU time of the browser's main process and every
 * descendant (renderer/content, GPU, utility processes).
 *
 * Supported: macOS (ps, centisecond resolution) and Linux (/proc).
 *
 * Limitations:
 *   - Work done outside the tree (e.g. the macOS WindowServer compositor) is not counted.
 *   - CPU time of a process that exits mid-window is lost (reported as `exitedProcesses`).
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ProcessCpu {
	pid: number;
	ppid: number;
	cpuSec: number;
	role: string;
}

export interface TreeSample {
	takenAt: number;
	processes: Map<number, ProcessCpu>;
}

export interface CpuDelta {
	wallSec: number;
	cpuSec: number;
	/** CPU-seconds per wall-second, as a percentage of one core. */
	totalPct: number;
	byRolePct: Record<string, number>;
	processCount: number;
	exitedProcesses: number;
}

/** Parses ps `time` output: [[dd-]hh:]mm:ss[.ff] */
export function parsePsTime(value: string): number {
	let days = 0;
	let rest = value.trim();
	const dash = rest.indexOf('-');
	if (dash !== -1) {
		days = Number(rest.slice(0, dash));
		rest = rest.slice(dash + 1);
	}
	const parts = rest.split(':').map(Number);
	let seconds = 0;
	for (const part of parts) seconds = seconds * 60 + part;
	return days * 86400 + seconds;
}

/** Classifies a browser process by its command line. */
export function classifyProcess(args: string): string {
	// Chromium helpers
	const chromiumType = /--type=([a-z-]+)/.exec(args);
	if (chromiumType) {
		const type = chromiumType[1];
		if (type === 'renderer') return 'renderer';
		if (type === 'gpu-process') return 'gpu';
		return type === 'utility' ? 'utility' : type;
	}
	// Firefox child processes end with their type: tab, gpu, rdd, socket,
	// utility, forkserver, ... On Linux/Windows they are "firefox -contentproc
	// ... <type>"; on macOS they are ".../plugin-container ... <type>".
	if (args.includes('-contentproc') || args.includes('plugin-container')) {
		const firefoxType = /\s(tab|gpu|rdd|socket|utility|forkserver|vr|gmplugin)\s*$/.exec(args);
		if (firefoxType) return firefoxType[1] === 'tab' ? 'content' : firefoxType[1];
		return 'child';
	}
	return 'main';
}

interface PsRow {
	pid: number;
	ppid: number;
	cpuSec: number;
	args: string;
}

async function listProcesses(): Promise<PsRow[]> {
	if (process.platform === 'darwin') {
		const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,ppid=,time=,args='], {
			maxBuffer: 32 * 1024 * 1024
		});
		return stdout
			.split('\n')
			.map((line) => /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line))
			.filter((m): m is RegExpExecArray => m !== null)
			.map((m) => ({
				pid: Number(m[1]),
				ppid: Number(m[2]),
				cpuSec: parsePsTime(m[3]),
				args: m[4]
			}));
	}
	if (process.platform === 'linux') {
		const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,ppid=,args='], {
			maxBuffer: 32 * 1024 * 1024
		});
		const ticks = await clockTicks();
		const rows: PsRow[] = [];
		for (const line of stdout.split('\n')) {
			const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
			if (!m) continue;
			rows.push({ pid: Number(m[1]), ppid: Number(m[2]), cpuSec: 0, args: m[3] });
		}
		// Linux ps reports whole seconds, so read utime+stime from /proc instead.
		await Promise.all(
			rows.map(async (row) => {
				row.cpuSec = (await procCpuTicks(row.pid)) / ticks;
			})
		);
		return rows;
	}
	throw new Error(`CPU sampling is not supported on ${process.platform} (macOS and Linux only)`);
}

let cachedTicks: number | null = null;
async function clockTicks(): Promise<number> {
	if (cachedTicks === null) {
		try {
			const { stdout } = await execFileAsync('getconf', ['CLK_TCK']);
			cachedTicks = Number(stdout.trim()) || 100;
		} catch {
			cachedTicks = 100;
		}
	}
	return cachedTicks;
}

async function procCpuTicks(pid: number): Promise<number> {
	try {
		const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
		// Fields after the ")" that closes the command name; utime/stime are fields 14/15.
		const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
		return Number(fields[11]) + Number(fields[12]);
	} catch {
		return 0;
	}
}

/** Samples cumulative CPU time for rootPid and all its descendants. */
export async function sampleTree(rootPid: number): Promise<TreeSample> {
	const rows = await listProcesses();
	const children = new Map<number, PsRow[]>();
	const byPid = new Map<number, PsRow>();
	for (const row of rows) {
		byPid.set(row.pid, row);
		const list = children.get(row.ppid) ?? [];
		list.push(row);
		children.set(row.ppid, list);
	}

	const processes = new Map<number, ProcessCpu>();
	const root = byPid.get(rootPid);
	if (!root) throw new Error(`Browser process ${rootPid} not found`);
	const stack = [root];
	while (stack.length > 0) {
		const row = stack.pop()!;
		processes.set(row.pid, {
			pid: row.pid,
			ppid: row.ppid,
			cpuSec: row.cpuSec,
			role: row.pid === rootPid ? 'main' : classifyProcess(row.args)
		});
		stack.push(...(children.get(row.pid) ?? []));
	}
	return { takenAt: Date.now(), processes };
}

/** CPU used between two samples of the same tree. */
export function cpuDelta(start: TreeSample, end: TreeSample): CpuDelta {
	const wallSec = (end.takenAt - start.takenAt) / 1000;
	let cpuSec = 0;
	const byRole: Record<string, number> = {};
	for (const proc of end.processes.values()) {
		const before = start.processes.get(proc.pid)?.cpuSec ?? 0;
		const used = Math.max(0, proc.cpuSec - before);
		cpuSec += used;
		byRole[proc.role] = (byRole[proc.role] ?? 0) + used;
	}
	let exitedProcesses = 0;
	for (const pid of start.processes.keys()) {
		if (!end.processes.has(pid)) exitedProcesses++;
	}
	const pct = (sec: number) => Math.round((sec / wallSec) * 100 * 100) / 100;
	const byRolePct: Record<string, number> = {};
	for (const [role, sec] of Object.entries(byRole)) byRolePct[role] = pct(sec);
	return {
		wallSec,
		cpuSec,
		totalPct: pct(cpuSec),
		byRolePct,
		processCount: end.processes.size,
		exitedProcesses
	};
}
