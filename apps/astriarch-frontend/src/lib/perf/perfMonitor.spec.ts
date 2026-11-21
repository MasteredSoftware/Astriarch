import { describe, it, expect, vi, afterEach } from 'vitest';
import { writable, get } from 'svelte/store';

type PerfModule = typeof import('./perfMonitor');

async function loadPerf(search: string): Promise<PerfModule> {
	vi.resetModules();
	vi.stubGlobal('window', {
		location: { search },
		devicePixelRatio: 1,
		__ASTRIARCH_PERF__: undefined
	});
	vi.spyOn(console, 'info').mockImplementation(() => {});
	return import('./perfMonitor');
}

/** Minimal stand-in for the parts of Konva the monitor touches. */
function fakeKonva() {
	let idCounter = 1;
	class Node {
		_id = idCounter++;
		destroy() {
			return this;
		}
	}
	class Group extends Node {}
	type Handler = () => void;
	class Layer extends Node {
		index = 0;
		handlers: Record<string, Handler> = {};
		name() {
			return 'galaxy';
		}
		on(evt: string, fn: Handler) {
			this.handlers[evt] = fn;
		}
		draw() {
			this.handlers['beforeDraw.perf']?.();
			this.handlers['draw.perf']?.();
		}
	}
	const layer = new Layer();
	const stage = {
		getLayers: () => [layer],
		// Mirrors Konva: a predicate selector is applied to every descendant.
		find: (selector: unknown) => {
			if (typeof selector !== 'function') throw new Error('expected a predicate selector');
			return [1, 2, 3].filter(() => selector());
		}
	};
	return { konva: { Node, Group } as never, stage: stage as never, layer, Group };
}

describe('perfMonitor', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('is disabled without ?perf=1 and leaves stores untouched', async () => {
		const perf = await loadPerf('');
		expect(perf.perfEnabled).toBe(false);
		expect(perf.perfStart()).toBe(0);
		const store = writable(1);
		const originalSet = store.set;
		expect(perf.instrumentStore('x', store).set).toBe(originalSet);
		expect((window as Window).__perf).toBeUndefined();
	});

	it('records counters, timings and rates when enabled', async () => {
		const perf = await loadPerf('?perf=1');
		const api = window.__perf!;
		expect(perf.perfEnabled).toBe(true);
		api.reset();

		perf.perfCount('raf.test');
		perf.perfCount('raf.test', 2);
		const t = perf.perfStart();
		perf.perfEnd('work', t);

		const snap = api.snapshot();
		expect(snap.counters['raf.test']).toBe(3);
		expect(snap.ratesPerSec['raf.test']).toBeGreaterThan(0);
		expect(snap.timings['work']?.count).toBe(1);
		expect(snap.frames).toBeNull();
	});

	it('counts store sets and times fan-out without changing store behavior', async () => {
		const perf = await loadPerf('?perf=1');
		window.__perf!.reset();
		const store = perf.instrumentStore('model', writable(0));
		const seen: number[] = [];
		const unsub = store.subscribe((v) => seen.push(v));
		store.set(5);
		store.update((v) => v + 1);
		unsub();

		expect(get(store)).toBe(6);
		expect(seen).toEqual([0, 5, 6]);
		const snap = window.__perf!.snapshot();
		expect(snap.counters['store.model.set']).toBe(2);
		expect(snap.timings['store.model.fanout']?.count).toBe(2);
	});

	it('reset clears the previous window', async () => {
		const perf = await loadPerf('?perf=1');
		perf.perfCount('a');
		window.__perf!.reset();
		expect(window.__perf!.snapshot().counters['a']).toBeUndefined();
	});

	it('counts Konva nodes created and destroyed, excluding its own probes', async () => {
		const perf = await loadPerf('?perf=1');
		const { konva, stage, layer, Group } = fakeKonva();
		perf.perfRegisterKonvaStage(konva, stage);
		window.__perf!.reset();

		const nodes = [new Group(), new Group(), new Group()];
		nodes[0]!.destroy();
		layer.draw();
		layer.draw();

		const snap = window.__perf!.snapshot();
		expect(snap.konva.nodesCreated).toBe(3);
		expect(snap.konva.nodesDestroyed).toBe(1);
		expect(snap.konva.nodeCount).toBe(3);
		expect(snap.counters['konva.draw.galaxy']).toBe(2);
		expect(snap.timings['konva.draw.galaxy']?.count).toBe(2);

		// A second snapshot in the same window must not count the first one's probe.
		expect(window.__perf!.snapshot().konva.nodesCreated).toBe(3);
	});

	it('reports an explicit 0 for a registered layer that was not drawn', async () => {
		const perf = await loadPerf('?perf=1');
		const { konva, stage, layer } = fakeKonva();
		perf.perfRegisterKonvaStage(konva, stage);
		layer.draw();
		window.__perf!.reset();

		const snap = window.__perf!.snapshot();
		expect(snap.counters['konva.draw.galaxy']).toBe(0);
		expect(snap.ratesPerSec['konva.draw.galaxy']).toBe(0);
		expect(snap.konva.registered).toBe(true);
		expect(snap.konva.layers).toEqual(['konva.draw.galaxy']);
	});

	it('reports when no Konva stage is registered', async () => {
		await loadPerf('?perf=1');
		window.__perf!.reset();
		const snap = window.__perf!.snapshot();
		expect(snap.konva.registered).toBe(false);
		expect(snap.konva.layers).toBeNull();
		expect(snap.konva.nodesCreated).toBeNull();
	});
});
