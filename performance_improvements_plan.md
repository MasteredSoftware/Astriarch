# Performance Improvements Plan

Goal: reduce the frontend's CPU use, especially in Firefox, and judge every change by measurement rather than by guesswork.

Phase 1 builds a repeatable, automated way to measure performance. Phase 2 applies fixes one at a time and A/B-tests each one against the Phase 1 baseline.

## Findings (as of master `3d2ada9`)

### Two per-frame loops do full work whether or not anything changed

1. **Game store loop** ([gameStore.ts](apps/astriarch-frontend/src/lib/stores/gameStore.ts), `startGameLoop`)
   - On every `requestAnimationFrame` it calls `advanceClientGameModelTime()` and then `clientGameModel.set(...)`.
   - That set notifies every subscriber (8 Svelte components plus every derived store), so the DOM UI re-evaluates 60 times a second, or 120–144 on high-refresh displays.

2. **Canvas loop** ([GalaxyCanvas.svelte](apps/astriarch-frontend/src/lib/components/galaxy/GalaxyCanvas.svelte), `startRenderLoop` / `updateGameObjects`)
   - On every frame it:
     - rebuilds the `planetByHexCoords` index
     - calls `update()` on every `DrawnPlanet`
     - **destroys and recreates every `DrawnFleet`'s Konva nodes**, which causes constant memory churn and garbage collection
     - calls `batchDraw()` on `galaxyLayer` and `fleetLayer`.
   - Since Konva 8, layers redraw themselves when a node attribute changes, so those `batchDraw()` calls are redundant.

### Konva tips: what master already does and what it doesn't

From <https://konvajs.org/docs/performance/All_Performance_Tips.html>:

| Tip | Status |
| --- | --- |
| `Konva.pixelRatio = 1` | Already in master |
| `listening(false)` on layers and shapes | Already in master |
| `perfectDrawEnabled(false)` | Already in master |
| `shadowForStrokeEnabled(false)` | Already in master |
| Few layers (3–5) | Already in master (galaxy, fleet, ui) |
| `shape.cache()` for complex or static content | **Not used** |
| Separate static layer for the background | **Not used.** The background shares `galaxyLayer` with the planets |
| Avoid shadows | **Not followed.** 100 background stars use `shadowBlur`, and planet rings and travel lines use shadows. Canvas shadows are known to be slow in Firefox |
| Remove or hide off-screen nodes | **Not used** |
| `destroy()` nodes and tweens when done | Mostly done, but the canvas destroys fleets *every frame* instead of keeping them |
| Use `Konva.Animation` instead of a raw rAF loop | **Not used.** We use raw rAF loops |

### Old attempt: commit `f8a54daa` (branch `bot-performance-improvements`)

- It isn't on master and was made on the old `apps/astriarch-frontend-sveltekit` path, so it would have to be ported by hand.
- **Right idea:** only draw when something changed.
- **What falls short:**
  - It still checks every frame, plus a 500ms `setTimeout` when idle.
  - It still recreates every fleet whenever fleet data changes.
  - It treats the whole model as changed whenever `lastSnapshotTime` changes, which is too coarse.
  - Its per-layer dirty flags repeat what Konva's automatic redraw already does.
  - Its frame-stats bookkeeping runs inside the hot loop.
  - It cut the background stars from 100 to 50 and only draws hex labels when zoomed in. These are reasonable but small changes, and they were never measured.
- **Decision:** take the idea, not the code.

## Phase 1: Measurement harness

### 1. In-app instrumentation (off by default)

- A new `apps/astriarch-frontend/src/lib/perf/` module, turned on with `?perf=1` or `window.__ASTRIARCH_PERF__ = true`. When it is off it must cost close to nothing, so no timing work runs in the hot path.
- **Timings**, using `performance.now()` with very little overhead:
  - engine advance (`advanceClientGameModelTime`)
  - store fan-out (time spent inside `clientGameModel.set`)
  - canvas `updateGameObjects`
  - Konva layer draws, via each layer's `draw` event, broken down per layer.
- **Counters that come out the same on every run:**
  - Konva nodes created and destroyed per second
  - layer draws per second
  - `clientGameModel` notifications per second.
- **Frame-time histogram** (p50/p95/p99, plus the count of frames over 16.7ms and over 33ms), built from `requestAnimationFrame` timestamps.
- Exposed as `window.__perf.snapshot()` and `window.__perf.reset()` so Playwright can read them. These work the same in Chromium and Firefox.

### 2. A repeatable benchmark scenario

- New spec: `apps/astriarch-frontend/e2e/perf/galaxy.perf.spec.ts`.
- It reuses the existing lobby and game helpers (`e2e/helpers/lobby.ts`, `inGame.ts`, `gameOptions.ts`) to start a human-vs-AI game, as scenario A does.
- It pins the galaxy size and player count.
- **Seeded random generator:** the engine calls `Math.random` with no seed (in `utils/utils.ts` and `engine/battleSimulator.ts`). Add a seedable generator in `utils.ts` behind an optional game option so that every perf run uses the same map. Normal games keep their current behavior.
  - *Alternative still open:* load a saved game from Mongo via scenario C's resume flow.
- It measures three fixed windows, each about 20s, after a warm-up:
  - **Idle:** no input. This is the "why is my CPU busy when nothing happens" case.
  - **Pan/zoom:** scripted mouse drags and wheel events across the galaxy.
  - **Fleets in transit:** send ships, then measure while several fleets are moving.

### 3. CPU measured at the OS level, the same way for both browsers

- Playwright can't use Chrome's DevTools protocol on Firefox (Firefox runs on Playwright's own Juggler protocol).
- So the shared metric is **CPU-seconds per wall-clock second** for the whole browser process tree. We sample cumulative CPU time with `ps` (or `pidusage`/`pidtree`) at the start and end of each window. This directly measures "taxes the CPU".
- Chromium also gets `Performance.getMetrics` (TaskDuration, ScriptDuration, LayoutDuration, JSHeapUsedSize) as extra detail.

### 4. Run conditions that keep results meaningful

- Run against the **production build** (`vite build` + `vite preview`), not the dev server, which adds Svelte dev-mode and hot-reload overhead.
- Run **headed**: headless rendering paths differ, especially for Firefox and GPU canvas.
- Add Playwright projects `chromium-perf` and `firefox-perf`, kept separate from the normal e2e suite (their own config or a grep tag) so that `test:e2e` is unaffected.
- Repeat each window 5×. Report the median and spread (min/max or IQR).
- Use the same machine for comparisons, on AC power, with nothing else heavy running.

### 5. Baseline and comparison tooling

- `pnpm --filter astriarch-frontend perf` writes `perf-results/<git-sha>-<browser>.json`, which includes machine details, browser version and screen refresh rate.
- `pnpm --filter astriarch-frontend perf:compare <a> <b>` prints per-metric deltas and flags any change within the measured noise as "no significant change".
- **CI:** only the deterministic counters run as hard assertions, for example "0 Konva nodes created per idle second" and "at most N store notifications per second when idle". Timing-based numbers stay local because they are too noisy in CI.

### 6. Engine micro-benchmark

- A Vitest `bench` in `packages/astriarch-engine` for `advanceClientGameModelTime`, run against a fixed model. It separates engine cost from rendering cost.

### 7. Manual diagnosis aid

- A short README section (in `e2e/README.md` or a new `docs/perf.md`) on:
  - capturing a Firefox Profiler trace (<https://profiler.firefox.com>) of the benchmark scenario
  - checking `about:support` to see whether canvas acceleration and WebRender are on
  - the Chromium Performance panel equivalent.

### Phase 1 is done when

- `pnpm --filter astriarch-frontend perf` runs end to end in both Chromium and Firefox, headed, against the production build.
- A baseline JSON for current master exists for both browsers.
- The run-to-run noise for each metric is known, so later changes can be judged against it.

### Phase 1 status (2026-11-22)

The harness is implemented; see [apps/astriarch-frontend/e2e/perf/README.md](apps/astriarch-frontend/e2e/perf/README.md).

The baselines below were re-recorded on 2026-11-22 with the harness as updated by the review of PR #72 (result schema version 2): budgets fail on missing metrics, a harness-side rAF probe records the refresh rate and device pixel ratio and detects throttling, and `rendered.*` and `frames.droppedPct` replace the fixed 16.7/33.3ms frame thresholds. Result files: `perf-results/baseline-v2-{chromium,firefox}.json`. Schema version 3 later redefined `rendered.*` to count display frames rather than draw tasks; the `rendered.fps` rows below use the v2 definition and will be re-recorded. The other rows are unaffected. Both runs had no harness warnings (throttling, visibility or focus). The first baselines (schema version 1, 2026-11-20) agreed with these within noise.

**Chromium baseline:** `perf/phase-1-measurement` at `e1ecf7e` (master plus the Phase 1 instrumentation; no app changes), Chromium 159, Apple M1 Max on AC power, 120.5Hz display at 1× pixel ratio, 5 × 20s windows after a 10s warm-up. Medians, with [min–max]:

| Metric | idle | panzoom | fleets |
| --- | --- | --- | --- |
| CPU, whole browser (% of one core) | 91.7 [88.8–94.2] | 95.3 [92.9–97.7] | 90.6 [88.4–92.1] |
| … renderer / GPU process | ~40 / ~51 | ~42 / ~49 | ~40 / ~50 |
| Konva nodes created per second (and destroyed) | 4,560 | 4,560 | 4,920 |
| `clientGameModel.set` per second | 120 | 120 | 120 |
| Frames in which the canvas drew (`rendered.fps`, schema v2: counted draw tasks; superseded, to be re-recorded) | 120 | 122 | 120 |
| Galaxy layer draw, ms per second | 123 | 125 | 128 |
| `updateGameObjects`, ms per second | 47 | 47 | 57 |
| Engine clock advance, ms per second | 2.3 | 2.2 | 2.3 |
| Store fan-out, ms per second | 5.5 | 3.5 | 2.8 |

What this shows:

- **Idle costs as much as interaction.** The browser uses about one full core whether or not anything happens. This confirms that the per-frame loops, not the drawing itself, set the cost.
- **About 38 Konva nodes are created and destroyed per frame,** even at idle with no fleets. That is more than the fleet recreation alone accounts for, so the planet indicators recreated in `DrawnPlanet.update` are likely contributors.
- **The engine is not the problem:** about 2ms per second in the browser, and about 4µs per call in the engine micro-benchmark.
- **Over half the CPU is in the GPU process,** from redrawing and compositing the galaxy layer 120 times a second.
- **Noise:** whole-browser CPU varies by about 5 points between repetitions, so a single change needs to beat that to show as significant. The counters vary by less than 0.1%.

**Firefox baseline:** same commit and settings, Playwright Firefox 159 on macOS, 119.9Hz at 1×. Medians, with [min–max]:

| Metric | idle | panzoom | fleets |
| --- | --- | --- | --- |
| CPU, whole browser (% of one core) | 200.9 [196.7–203.3] | 195.4 [193.3–196.6] | 191.5 [188.3–194.0] |
| … parent (main) / content process | ~154 / ~46 | ~152 / ~43 | ~142 / ~49 |
| Konva nodes created per second (and destroyed) | 4,524 | 4,349 | 4,882 |
| `clientGameModel.set` per second | 119 | 114 | 119 |
| Frames in which the canvas drew (`rendered.fps`, schema v2: counted draw tasks; superseded, to be re-recorded) | 119 | 116 | 119 |
| Display refreshes with no frame (`frames.droppedPct`) | – | 4.6% | 0.8% |
| Galaxy layer draw, ms per second | 163 | 160 | 178 |
| `updateGameObjects`, ms per second | 65 | 65 | 94 |
| Engine clock advance, ms per second | 3.9 | 3.3 | 3.7 |
| Store fan-out, ms per second | 9.7 | 6.6 | 6.5 |

What this adds:

- **Firefox uses about twice Chromium's CPU for the same work:** about 2 cores against 1, at the same ~118 frames per second and the same node churn. It also drops about 5% of display refreshes while panning; Chromium drops none.
- **Three quarters of Firefox's CPU is in the parent process.** On macOS, Playwright's Firefox has no separate GPU process, so WebRender's compositing and canvas uploads run in the parent. The content process, where our JavaScript and Konva's drawing run, is about 46%. So the biggest cost in Firefox is presenting a freshly redrawn canvas 118 times a second, not our JavaScript. Steps 1 and 2 below (stop redrawing when nothing changed) should therefore help Firefox even more than Chromium.
- **Firefox is the more sensitive benchmark:** whole-browser CPU varies by about 3–6 points between repetitions, similar to Chromium's ~5 in this run (the first baseline showed under 2 against ~8). Either browser works as the main A/B check in Phase 2; run both.
- Process roles in Firefox: on macOS the child processes are `plugin-container` (not `firefox -contentproc`). The first Firefox run counted every process as `main` until `cpuSampler.ts` was fixed to recognise them. The totals were unaffected.

## Phase 2: Fixes (one at a time, each A/B-tested against the baseline)

Ordered by the impact we expect. After each step, rerun `perf` and `perf:compare` against the previous result, and keep only changes that measurably help without hurting visual quality.

### Rule for all of Phase 2: event-driven, not polled

When `f8a54daa` was first written, the review feedback was "should be more event driven". That commit set dirty flags, but a loop still checked them every frame, and a 500ms `setTimeout` kept polling when idle. Phase 2 must not repeat that pattern:

- **Changes push work; nothing polls for it.** Store subscriptions, explicit events from the websocket and engine (planet changed, fleet added/moved/removed, selection changed, view/zoom changed) and Konva's own attribute-change redraw are what trigger updates. No per-frame or timer loop checks whether anything is dirty.
- **Dirty state is set by the event that caused it,** and it is narrow: one planet, one fleet or the selection, not "the whole model". A handler marks exactly what changed, and the work is coalesced into a single update on the next frame. A `requestAnimationFrame` is scheduled only when something was marked, and is never left running.
- **When nothing changes, nothing runs.** With no input and no fleets in transit, there should be no running rAF loops, no timers and no Konva draws. The deterministic idle counters from Phase 1 check this.
- **The only per-frame work is the fleet animation,** a `Konva.Animation` that starts when the first fleet enters transit and stops when the last one arrives.
- **Model changes report what changed.** Where the engine or store only replaces the whole `clientGameModel`, add a way to report the specific change (a diff, a change list, or more specific stores and events) instead of having consumers compare snapshots every frame.

1. **Make the canvas update only when the data changes**
   - Replace the canvas rAF polling loop with a subscription to `clientGameModel` and `gameGrid`, and diff what changed.
   - Keep `DrawnFleet` instances alive, keyed by a stable fleet ID instead of the array index. Update their positions in place and create or destroy one only when that fleet appears or disappears.
   - Rebuild `planetByHexCoords` only when the set of planets changes.
   - Remove the redundant `batchDraw()` calls and let Konva's automatic redraw work.
   - For smooth fleet motion between model updates, use a `Konva.Animation` bound to `fleetLayer` that runs only while fleets are in transit.

2. **Slow the store's fan-out**
   - Advance the engine at a fixed tick. CLAUDE.md gives `MS_PER_TICK` = 200ms for client updates. Check how this interacts with fleet animation smoothness, which step 1's per-frame interpolation should cover.
   - Audit the 8 components that subscribe to `clientGameModel` and the derived stores in `gameStore.ts`. Use narrower derived stores that skip updates when their value hasn't changed, so unrelated UI doesn't re-render on every tick.

3. **Static background**
   - Move the stars, hex grid and hex labels to their own layer and `cache()` it, or render it once to an image.
   - Remove or replace `shadowBlur` on stars, planet rings and travel lines. Pre-render glows as images or use semi-transparent fills instead.
   - Consider showing hex labels only above a zoom threshold, as `f8a54daa` tried. This only counts if it measurably helps.

4. **Only if the numbers still show a problem**
   - Re-check `Konva.pixelRatio` (it is 1 today, which trades sharpness on retina screens for speed).
   - Hide nodes outside the viewport.
   - Re-check the layer count.
   - Look at Firefox-specific canvas settings.

## Open decisions

- **Seeded random generator vs. saved game:** the plan above assumes a seeded generator behind a game option. Loading a saved game from Mongo via scenario C's resume flow is the alternative.
- **What runs in CI:** the plan assumes local, headed runs for timing, with only the deterministic counters as CI checks.
