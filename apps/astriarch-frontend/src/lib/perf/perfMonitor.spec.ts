import { describe, it, expect, vi, afterEach } from 'vitest';
import { writable, get } from 'svelte/store';

type PerfModule = typeof import('./perfMonitor');

/**
 * Stand-in for requestAnimationFrame: runFrame(ts) runs the callbacks requested
 * before it, in request order; callbacks requested during a frame run in the
 * next one, as in the browser.
 */
function fakeFrames() {
	let nextId = 1;
	let queue: { id: number; cb: FrameRequestCallback }[] = [];
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		const id = nextId++;
		queue.push({ id, cb });
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		queue = queue.filter((entry) => entry.id !== id);
	});
	return {
		pending: () => queue.length,
		runFrame(ts: number) {
			const current = queue;
			queue = [];
			for (const { cb } of current) cb(ts);
		}
	};
}

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
		index: number;
		handlers: Record<string, Handler[]> = {};
		constructor(
			private layerName: string,
			index = 0
		) {
			super();
			this.index = index;
		}
		name() {
			return this.layerName;
		}
		on(evt: string, fn: Handler) {
			(this.handlers[evt] ??= []).push(fn);
		}
		draw() {
			for (const fn of this.handlers['beforeDraw.perf'] ?? []) fn();
			for (const fn of this.handlers['draw.perf'] ?? []) fn();
		}
	}
	const layer = new Layer('galaxy');
	const layers: Layer[] = [layer];
	// Konva's Stage.destroy() detaches `content`; tests flip isConnected instead.
	const content = { isConnected: true };
	const stage = {
		content,
		getLayers: () => layers,
		// Mirrors Konva: a predicate selector is applied to every descendant.
		find: (selector: unknown) => {
			if (typeof selector !== 'function') throw new Error('expected a predicate selector');
			return [1, 2, 3].filter(() => selector());
		}
	};
	const addLayer = (name: string) => {
		const added = new Layer(name, layers.length);
		layers.push(added);
		return added;
	};
	return {
		konva: { Node, Group } as never,
		stage: stage as never,
		layer,
		addLayer,
		content,
		Group
	};
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

	it('reports running CSS animations in the snapshot', async () => {
		await loadPerf('?perf=1');
		class CSSAnimation {
			constructor(
				public playState: string,
				public animationName: string
			) {}
			effect = {
				target: { tagName: 'DIV', getAttribute: () => 'scan-line absolute' }
			};
		}
		vi.stubGlobal('document', {
			getAnimations: () => [
				new CSSAnimation('running', 'scan'),
				new CSSAnimation('finished', 'fade')
			]
		});
		expect(window.__perf!.snapshot().runningAnimations).toEqual([
			'CSSAnimation scan on div.scan-line'
		]);
	});

	describe('looping animations', () => {
		class CSSAnimation {
			constructor(
				public animationName: string,
				public iterations: number,
				public playState = 'running'
			) {}
			effect = {
				target: { tagName: 'DIV', getAttribute: () => 'scan-line absolute' },
				getComputedTiming: () => ({ iterations: this.iterations })
			};
		}

		it('counts only infinite animations running at both window start and snapshot', async () => {
			await loadPerf('?perf=1');
			const loop = new CSSAnimation('dots', Infinity);
			const finite = new CSSAnimation('pulse', 2);
			const ended = new CSSAnimation('fade', Infinity);
			let animations = [loop, finite, ended];
			vi.stubGlobal('document', { getAnimations: () => animations });
			window.__perf!.reset();

			// An infinite hover loop starts mid-window; the infinite fade finishes
			const lateLoop = new CSSAnimation('hover-scan', Infinity);
			ended.playState = 'finished';
			animations = [loop, finite, ended, lateLoop];

			const snap = window.__perf!.snapshot();
			expect(snap.loopingAnimations).toEqual(['CSSAnimation dots on div.scan-line']);
			// The raw list keeps every running animation, for diagnosis
			expect(snap.runningAnimations).toEqual([
				'CSSAnimation dots on div.scan-line',
				'CSSAnimation pulse on div.scan-line',
				'CSSAnimation hover-scan on div.scan-line'
			]);
		});

		it('does not count an animation without computed timing as looping', async () => {
			await loadPerf('?perf=1');
			const noTiming = { ...new CSSAnimation('x', Infinity), effect: null };
			vi.stubGlobal('document', { getAnimations: () => [noTiming] });
			window.__perf!.reset();
			expect(window.__perf!.snapshot().loopingAnimations).toEqual([]);
		});

		it('reports null for both lists where getAnimations is unsupported', async () => {
			await loadPerf('?perf=1');
			vi.stubGlobal('document', {});
			window.__perf!.reset();
			const snap = window.__perf!.snapshot();
			expect(snap.runningAnimations).toBeNull();
			expect(snap.loopingAnimations).toBeNull();
		});
	});

	it('reset clears the previous window', async () => {
		const perf = await loadPerf('?perf=1');
		perf.perfCount('a');
		window.__perf!.reset();
		expect(window.__perf!.snapshot().counters['a']).toBeUndefined();
	});

	it('counts Konva nodes created and destroyed, excluding its own probes', async () => {
		fakeFrames();
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
		fakeFrames();
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

	describe('rendered frames', () => {
		async function setup(extraLayers: string[] = []) {
			const frames = fakeFrames();
			const perf = await loadPerf('?perf=1');
			const k = fakeKonva();
			const extra = extraLayers.map((name) => k.addLayer(name));
			perf.perfRegisterKonvaStage(k.konva, k.stage);
			window.__perf!.reset();
			return { frames, extra, ...k };
		}

		it('schedules nothing while nothing draws', async () => {
			const { frames } = await setup();
			expect(frames.pending()).toBe(0);
			frames.runFrame(10);
			expect(window.__perf!.snapshot().renderedFrames).toMatchObject({ count: 0, p50Ms: null });
		});

		it('counts draws in separate tasks before one frame as one frame', async () => {
			const { frames, layer } = await setup();
			layer.draw();
			layer.draw();
			expect(frames.pending()).toBe(1);
			expect(window.__perf!.snapshot().renderedFrames?.count).toBe(0);
			frames.runFrame(10);
			expect(window.__perf!.snapshot().renderedFrames?.count).toBe(1);
			expect(frames.pending()).toBe(0);
		});

		it('counts draws in different rAF callbacks of the same frame as one frame', async () => {
			const { frames, layer, extra } = await setup(['ui']);
			const ui = extra[0]!;
			requestAnimationFrame(() => layer.draw());
			requestAnimationFrame(() => ui.draw());
			frames.runFrame(10);
			frames.runFrame(20);
			expect(window.__perf!.snapshot().renderedFrames?.count).toBe(1);
		});

		it('counts one frame per display frame when Konva draws in every frame', async () => {
			const { frames, layer } = await setup();
			// GalaxyCanvas: each frame Konva's batchDraw callback draws, then the
			// render loop requests the next batchDraw and then itself.
			const konvaDraw = () => layer.draw();
			const render = () => {
				requestAnimationFrame(konvaDraw);
				requestAnimationFrame(render);
			};
			requestAnimationFrame(konvaDraw);
			requestAnimationFrame(render);
			for (let frame = 1; frame <= 11; frame++) frames.runFrame(frame * 10);

			const snap = window.__perf!.snapshot();
			expect(snap.counters['konva.draw.galaxy']).toBe(11);
			// The last frame's draws are counted by the next frame's one-shot.
			expect(snap.renderedFrames).toMatchObject({ count: 10, p50Ms: 10, maxMs: 10 });
		});

		it('counts draws in different frames as separate frames', async () => {
			const { frames, layer } = await setup();
			layer.draw();
			frames.runFrame(10);
			frames.runFrame(20);
			layer.draw();
			frames.runFrame(30);
			const rendered = window.__perf!.snapshot().renderedFrames!;
			expect(rendered.count).toBe(2);
			expect(rendered.p50Ms).toBe(20);
			expect(rendered.fps).toBeGreaterThan(0);
		});

		it('reset cancels a pending frame', async () => {
			const { frames, layer } = await setup();
			layer.draw();
			window.__perf!.reset();
			expect(frames.pending()).toBe(0);
			frames.runFrame(10);
			expect(window.__perf!.snapshot().renderedFrames?.count).toBe(0);
		});
	});

	it('reports a detached stage as unregistered and drops its zero counters', async () => {
		fakeFrames();
		const perf = await loadPerf('?perf=1');
		const { konva, stage, content } = fakeKonva();
		perf.perfRegisterKonvaStage(konva, stage);
		content.isConnected = false;
		window.__perf!.reset();

		const snap = window.__perf!.snapshot();
		expect(snap.konva.registered).toBe(false);
		expect(snap.konva.unhookedLayers).toEqual([]);
		expect(snap.counters['konva.draw.galaxy']).toBeUndefined();
		expect(snap.renderedFrames).toBeNull();
	});

	it('reports a layer added after registration as unhooked', async () => {
		fakeFrames();
		const perf = await loadPerf('?perf=1');
		const { konva, stage, addLayer } = fakeKonva();
		perf.perfRegisterKonvaStage(konva, stage);
		addLayer('ui');
		window.__perf!.reset();

		const snap = window.__perf!.snapshot();
		expect(snap.konva.registered).toBe(false);
		expect(snap.konva.unhookedLayers).toEqual(['konva.draw.ui']);
		expect(snap.renderedFrames).toBeNull();

		// Registering again hooks it.
		perf.perfRegisterKonvaStage(konva, stage);
		expect(window.__perf!.snapshot().konva).toMatchObject({
			registered: true,
			unhookedLayers: []
		});
	});

	it('does not double-count draws when a stage is registered twice', async () => {
		fakeFrames();
		const perf = await loadPerf('?perf=1');
		const { konva, stage, layer } = fakeKonva();
		perf.perfRegisterKonvaStage(konva, stage);
		perf.perfRegisterKonvaStage(konva, stage);
		window.__perf!.reset();
		layer.draw();
		const snap = window.__perf!.snapshot();
		expect(snap.counters['konva.draw.galaxy']).toBe(1);
		expect(snap.timings['konva.draw.galaxy']?.count).toBe(1);
	});

	it('counts dropped frames against the given refresh interval', async () => {
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {});
		await loadPerf('?perf=1');
		window.__perf!.reset({ sampleFrames: true, refreshIntervalMs: 10 });
		// Intervals: 10 (on time), 14 (jitter), 20 (1 dropped), 31 (2 dropped, slow)
		let ts = 0;
		for (const step of [0, 10, 14, 20, 31]) {
			ts += step;
			rafCallbacks.shift()!(ts);
		}
		const frames = window.__perf!.snapshot().frames!;
		expect(frames.count).toBe(4);
		expect(frames.periodMs).toBe(10);
		expect(frames.droppedFrames).toBe(3);
		expect(frames.slowOver1_5x).toBe(2);
	});

	it('falls back to the median interval as the frame period', async () => {
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {});
		await loadPerf('?perf=1');
		window.__perf!.reset({ sampleFrames: true });
		let ts = 0;
		for (const step of [0, 16, 17, 16, 50]) {
			ts += step;
			rafCallbacks.shift()!(ts);
		}
		const frames = window.__perf!.snapshot().frames!;
		expect(frames.periodMs).toBe(16);
		expect(frames.droppedFrames).toBe(2);
		expect(frames.slowOver1_5x).toBe(1);
	});

	it('reports when no Konva stage is registered', async () => {
		await loadPerf('?perf=1');
		window.__perf!.reset();
		const snap = window.__perf!.snapshot();
		expect(snap.konva.registered).toBe(false);
		expect(snap.konva.layers).toBeNull();
		expect(snap.konva.nodesCreated).toBeNull();
		expect(snap.renderedFrames).toBeNull();
	});
});
