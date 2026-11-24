# Performance Improvements Plan

Goal: reduce the frontend's CPU use, especially in Firefox, and judge every change by measurement rather than by guesswork.

Phase 1 builds a repeatable, automated way to measure performance. Phase 2 applies fixes one at a time and A/B-tests each one against the Phase 1 baseline.

## Status (2026-11-22)

**Phase 1 is done** (PR #72, branch `perf/phase-1-measurement`). **Phase 2 is paused here as good enough for now** (branch `perf/phase-2-event-driven-canvas`, stacked on Phase 1). The remaining steps are deferred; see [Deferred work](#deferred-work).

Whole-browser CPU, % of one core (macOS, 120Hz display, 5 × 20s windows, medians; baseline-v3 at `ae7fafd` against Phase 2 at `c641c44`, both recorded on 2026-11-22, see [After the PR #73 review fixes](#after-the-pr-73-review-fixes-2026-11-22)):

| Window | Firefox baseline → now | Chromium baseline → now |
| --- | --- | --- |
| idle | 201.8 → **14.2** (−93%) | 97.6 → **11.0** (−89%) |
| panzoom | 196.2 → **77.4** (−61%) | 102.3 → **61.1** (−40%) |
| fleets | 192.7 → **28.1** (−85%) | 96.3 → **20.2** (−79%) |

What got us there (details under [Phase 2 status](#phase-2-status)):

1. The canvas updates from store events instead of a per-frame loop. It stops recreating Konva nodes: about 4,500 per second → 0.
2. The client model advances at a fixed 200ms tick instead of every frame. A fleet animation runs only while some fleet in transit can move a visible distance between ticks.
3. Two decorative CSS animations that looped forever were stopped. The task-card scan-line and the Fleet Command prompt pulse made the browser composite every frame, and they turned out to be the largest single costs left.

All deterministic budgets pass in every window in both browsers, including a new check that no CSS/Web animation loops forever. The `build` window added in the second round of review (Planet Overview with a build in progress) settled the build progress bar: it keeps a one-tick `scaleX` CSS transition, which is smooth but keeps the browser compositing every frame while a build is on screen (+34 CPU points in Chromium, +17 in Firefox over stepping). Cheaper bars were measured and judged not smooth enough (see [The build progress bar](#the-build-progress-bar-2026-11-22)).

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

The baselines below were re-recorded on 2026-11-22 with the harness as updated by the review of PR #72 (result schema version 2): budgets fail on missing metrics, a harness-side rAF probe records the refresh rate and device pixel ratio and detects throttling, and `rendered.*` and `frames.droppedPct` replace the fixed 16.7/33.3ms frame thresholds. Result files: `perf-results/baseline-v2-{chromium,firefox}.json`. Schema version 3 later redefined `rendered.*` to count display frames in which the canvas drew, rather than draw tasks. The `rendered.fps` rows below were re-recorded with schema v3 on 2026-11-22 (`perf-results/baseline-v3-{chromium,firefox}.json` at `ae7fafd`, no harness warnings). The v3 values never exceed the refresh rate; v2 showed 122 in Chromium panzoom on a 120.5Hz display. The other rows stand from baseline-v2. Whole-browser CPU in baseline-v3 agreed with v2 within noise in Firefox (201.8 / 196.2 / 192.7 against 200.9 / 195.4 / 191.5). In Chromium it was about 6 points higher, more than the noise: 97.6 [96.0–102.0] / 102.3 [101.1–105.8] / 96.3 [94.6–100.2] against the v2 values below, with no overlap in the ranges. Both baseline-v2 runs had no harness warnings (throttling, visibility or focus). The first baselines (schema version 1, 2026-11-20) agreed with these within noise.

**Chromium baseline:** `perf/phase-1-measurement` at `e1ecf7e` (master plus the Phase 1 instrumentation; no app changes), Chromium 159, Apple M1 Max on AC power, 120.5Hz display at 1× pixel ratio, 5 × 20s windows after a 10s warm-up. Medians, with [min–max]:

| Metric | idle | panzoom | fleets |
| --- | --- | --- | --- |
| CPU, whole browser (% of one core) | 91.7 [88.8–94.2] | 95.3 [92.9–97.7] | 90.6 [88.4–92.1] |
| … renderer / GPU process | ~40 / ~51 | ~42 / ~49 | ~40 / ~50 |
| Konva nodes created per second (and destroyed) | 4,560 | 4,560 | 4,920 |
| `clientGameModel.set` per second | 120 | 120 | 120 |
| Display frames in which the canvas drew (`rendered.fps`, schema v3) | 120 | 120 | 120 |
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
| Display frames in which the canvas drew (`rendered.fps`, schema v3) | 119 | 114 | 118 |
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
   - For smooth fleet motion between model updates, use a `Konva.Animation` bound to `fleetLayer` that runs only while fleets are in transit. (Moved to step 2: while the model still advances every frame, fleets already move every frame.)

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

## Phase 2 status

### Step 1: event-driven canvas (2026-11-20, branch `perf/phase-2-event-driven-canvas`)

What changed:

- `GalaxyCanvas.svelte` has no rAF loop. Subscriptions to `clientGameModel` and `gameGrid` mark the canvas dirty, and one update per task is coalesced with `queueMicrotask`.
- `DrawnPlanet.update` only touches Konva when something visible changed:
  - The ring is recolored in place instead of being destroyed and recreated.
  - Strength and platform indicators are rebuilt only when their dot counts, platform count or owner color change.
  - Each planet image is loaded once. This fixed a bug: every frame started a new image load until one finished, which left 16 stacked `Konva.Image` nodes for 4 explored planets.
  - The waypoint line is updated only when it moves. The production dot now keeps its color current.
- `DrawnFleet`s are kept by fleet id and updated in place. `DrawnTravelLine.updateEndpoints` skips no-op updates, because setting points always redraws.
- The background (stars, hex grid, labels) is in its own group. A grid change rebuilds only that group; it no longer destroys the planets too.
- The `batchDraw()` calls are removed.
- The `rate.raf.canvas` budget became `rate.canvas.update` ≤ 6/s (the 5/s tick plus the odd server update).

Results (5 × 20s, medians; every change below is outside both runs' min–max ranges):

| Whole-browser CPU, % of one core | Firefox before → after | Chromium before → after |
| --- | --- | --- |
| idle | 199 → **87** (−56%) | 94 → **53** (−43%) |
| panzoom | 194 → **133** (−32%) | 96 → **76** (−21%) |
| fleets | 190 → **108** (−43%) | 92 → **56** (−40%) |

- Konva nodes created and destroyed per second went from about 4,500 to 0 in every window. The galaxy layer no longer redraws at idle or while fleets move.
- `updateGameObjects` fell from 67 to 7 ms per second in Firefox.
- A node-count and screenshot comparison shows the same galaxy. The only differences are the 12 duplicate planet images (gone) and one extra background group.
- **Read the "worse" timings with care.** The per-call times of unchanged code (the engine clock, game loop and store fan-out) rose 30–100%. Most likely macOS lowers the clock or uses efficiency cores once the browser no longer keeps a core busy. The fleet layer's per-draw time rose from 0.08 to 0.36 ms in the benchmark. Yet it holds the same 5 nodes as before, and drawn back to back it costs the same in both versions (0.115 vs 0.105 ms). Whole-browser CPU is the measure that counts.
- Idle budgets: 5 of 7 pass. `rate.store.clientGameModel.set` and `rate.canvas.update` (~120/s) are step 2.

### Step 2: fixed model tick (2026-11-20)

What changed:

- `gameStore.ts` advances the client model with `setInterval(…, MS_PER_TICK)` (200ms), not every animation frame. There is one `clientGameModel` update per tick.
- Fleets move smoothly between ticks. `DrawnFleet.animate()` extrapolates each fleet along its line at the engine's speed for its owner (`Fleet.getSpeed` divided by the game speed's ms per cycle), so it lands where the next tick puts it. A `Konva.Animation` runs only while some fleet can still move. It stops itself when none can: no fleet in transit, every fleet awaiting conflict resolution, or no model update for 1.5 ticks (the game is paused or the server is late). The next model update restarts it. Nodes change only when a fleet moves at least 0.5 screen px, so at normal game speed the fleet layer redraws only at ticks.
- In a background tab the game loop now keeps ticking at the browser's throttled timer rate (at least 1s, and about once a minute under Chrome's intensive throttling), where the rAF loop used to stop. Notifications, auto-queue checks and arrival requests therefore stay current while the tab is hidden. The engine clock is wall-time based, so the game state is the same either way.
- Harness: the store and canvas budgets are now ≤ 6/s, there is a new idle budget `rate.fleetAnimation.frame` = 0, and the throttle warnings use the 5/s tick and the frame rate.

Results against step 1 (5 × 20s, medians):

| Whole-browser CPU, % of one core | Firefox step 1 → step 2 | Chromium step 1 → step 2 |
| --- | --- | --- |
| idle | 87 → **77** (better) | 53 → 45 (within noise; renderer 18 → 8) |
| panzoom | 133 → 128 (within noise) | 76 → 74 (within noise) |
| fleets | 108 → **75** (better) | 56 → 48 (within noise; renderer 20 → 13) |

- Model and canvas updates fell from about 120/s to 5/s, and fleet layer draws from 60/s to 5/s.
- All 8 idle budgets pass in both browsers.
- Our JavaScript (Firefox content process) is now about 4% of a core at idle.

### Step 2b: stop the task card's looping scan-line animation (2026-11-21)

Finding:


`TaskItem.svelte` (the task notification cards, e.g. "Build Queue Empty") has a 1px `.scan-line` whose opacity pulses forever (`animation: scan 3s infinite`). It sits inside a card with `backdrop-blur`, over the canvas, so the browser composites every frame. Toggling only that animation, in the same game and window (10s windows):

| Idle CPU | as-is | scan-line animation off | animation and all backdrop blurs off |
| --- | --- | --- | --- |
| Firefox | 78% (parent 73%) | **12%** (parent 7%) | 10% |
| Chromium | 41% (GPU 32%) | **9%** (GPU 3%) | 8% |

Turning the animation back on restores the cost (76% / 44%). The backdrop blurs on their own cost little once nothing animates.

What changed:

- `.scan-line` now rests at opacity 0 and pulses twice when a card appears. It loops only while the card is hovered.
- `perfMonitor` records which CSS/Web animations are running when each window ends (`runningAnimations`). There is a new metric `dom.runningAnimations` and an idle budget of 0 for it.
- `sendFleet` in the harness records what each click hit and saves a screenshot on failure. One Firefox repetition once failed with Send Ships disabled; it didn't recur in 9 later sends.

Results (5 × 20s, medians):

| Whole-browser CPU, % of one core | Firefox step 2 → 2b | Chromium step 2 → 2b |
| --- | --- | --- |
| idle | 77 → **12.3** | 45 → **7.9** |
| panzoom | 128 → **76** | 74 → **58** |
| fleets | 75 → **64** | 48 → 40 (within noise) |

The new metric then caught another infinite animation during the fleets window: `CSSAnimation pulse on svg.h-6` (see step 2c).

### Step 2c: stop the Fleet Command prompt's looping pulse (2026-11-21)

Finding: while Fleet Command is open with no destination chosen (as after sending a fleet), the "Select a destination planet" icon used Tailwind's `animate-pulse`, which loops forever. In one live game (10s windows), fleets-window CPU was:

| Fleets window, % of one core | as-is | pulse off | pulse off and fleet animation stopped |
| --- | --- | --- | --- |
| Firefox | 64 | **17** | 17 |
| Chromium | 41 (GPU 29) | **12** (GPU 3) | 11 |

This suggested that step 2's fleet animation costs about 1 point or less. That figure was measured with the harness's frame sampler keeping rAF running, so it can't show the cost of the fleet animation's own rAF loop. The point is now moot: the animation stops whenever no fleet can move (see step 2).

What changed:

- The icon pulses 3 times when the prompt appears, then rests (a scoped `destination-prompt-pulse` animation).
- The `dom.runningAnimations` = 0 budget now also applies to the panzoom and fleets windows.
- Not changed: the paused-game modal's pulsing dots. They are a "waiting" indicator and only run while the game is paused.

Results (5 × 20s, medians):

| Whole-browser CPU, % of one core | Firefox 2b → 2c | Chromium 2b → 2c |
| --- | --- | --- |
| idle | 12.3 → 13.2 | 7.9 → 9.6 |
| panzoom | 76 → 77 | 58 → 58 |
| fleets | 64 → **28** | 40 → **20.5** |

Idle and panzoom don't open Fleet Command, so nothing changed on those paths. Their 1–2 point moves are run-to-run drift between sessions, even though the ranges just miss overlapping. All budgets pass in every window in both browsers.

### Phase 2 so far: baseline → step 2c

| Whole-browser CPU, % of one core | Firefox | Chromium |
| --- | --- | --- |
| idle | 199 → **13** (−93%) | 94 → **9.6** (−90%) |
| panzoom | 194 → **77** (−60%) | 96 → **58** (−39%) |
| fleets | 190 → **28** (−85%) | 92 → **20.5** (−78%) |

These step-by-step numbers were measured against the first baseline (harness schema version 1).

### After the PR #73 review fixes (2026-11-22)

The review of PR #73 changed behaviour in a few places:
- Fleet speed now comes from the engine instead of being measured between ticks.
- The fleet animation stops once no fleet can move. Since the second review round it also doesn't run while no fleet can move a visible distance (at least 0.5 screen px) before the next tick, e.g. at Normal speed and the default zoom; zooming in re-checks. The distance is one tick's worth (200ms), not the 1.5-tick extrapolation cap, because every tick resets the drawn position to the model one: a fleet that needs more than one tick to move 0.5px never draws between ticks.
- Duplicate fleet ids are drawn instead of dropped.
- The canvas is torn down fully.
- The build progress bar slides with a one-tick `transform: scaleX()` transition (no layout or paint per frame, unlike the earlier `width` transition) and snaps instead of sliding backwards. The review measured it against the `width` transition, a plain step at the tick and a script-driven bar redrawn 30 times a second; see [The build progress bar](#the-build-progress-bar-2026-11-22). The other variants were removed.

The baseline was re-recorded with harness schema v3 at `ae7fafd` (`perf-results/baseline-v3-*.json`, the PR #72 re-recording) and Phase 2 at `c641c44` (`perf-results/phase2-r2b-*.json`), on the same day, headed, on AC power, with no harness warnings. Medians, with [min–max]:

| Whole-browser CPU, % of one core | Firefox | Chromium |
| --- | --- | --- |
| idle | 201.8 → **14.2** [14.1–14.7] (−93%) | 97.6 → **11.0** [10.1–11.1] (−89%) |
| panzoom | 196.2 → **77.4** [76.8–77.6] (−61%) | 102.3 → **61.1** [59.8–63.4] (−40%) |
| fleets | 192.7 → **28.1** [27.5–28.8] (−85%) | 96.3 → **20.2** [19.2–21.6] (−79%) |
| build | **35.5** [34.9–35.6] with the `scaleX` bar; **17.0** [16.5–17.4] with the step | **44.7** [43.8–49.5] with the `scaleX` bar; **12.4** [11.9–12.8] with the step |

The baseline has no `build` window. The `build` row in `phase2-r2b` was recorded with the app's default bar at `c641c44`, which was still the `scaleX` transition, so its CPU reflects `scaleX`. The step's number is from `perf-results/bar2-none-*.json`. The app keeps the `scaleX` bar (see [The build progress bar](#the-build-progress-bar-2026-11-22)).

| Phase 2 at `c641c44` (baseline-v3 in brackets) | idle | panzoom | fleets | build |
| --- | --- | --- | --- | --- |
| Firefox `rendered.fps` | 0 (119) | 42.7 (114) | 5.0 (118) | 5.0 |
| Firefox `frames.droppedPct` | – | 0.12% (4.8%) | 0.08% (1.2%) | – |
| Chromium `rendered.fps` | 0 (120) | 61.5 (120) | 5.0 (120) | 5.0 |
| Chromium `frames.droppedPct` | – | 0% (0%) | 0% (0%) | – |
| `rate.konva.draw.fleet`, Firefox / Chromium | 0 / 0 (119 / 120) | 42.4 / 63.9 (116 / 122) | 5.0 / 5.0 (119 / 120) | 5.0 / 5.0 |
| `rate.fleetAnimation.frame`, both browsers | 0 | 0 | 0 | 0 |

- Chromium pan/zoom reads 61.1 against 58.1 in the first review round (`phase2-review`, `7902272`). The review fixes don't touch that path, so treat it as session drift until a re-run says otherwise.
- All budgets pass in every window in both browsers, and no run had a harness warning.
- The frame metrics add two things:
  - Firefox now drops 0.1% of display refreshes while panning, against 4.8% before.
  - The canvas draws on 0 frames per second at idle, against about 120.
- In the fleets and build windows the canvas redraws at the 5/s tick and the fleet animation doesn't run: `rate.fleetAnimation.frame` is 0 (the counter is absent) in all windows at `c641c44`. At this zoom and speed a fleet moves less than the 0.5px redraw threshold in one tick, so the one-tick gate never starts the animation. Before that gate fix, at `339eda2` (`perf-results/phase2-r2-*.json`), it ran at about 120 frames per second in the fleets and build windows of both browsers, even though it drew nothing.

### The build progress bar (2026-11-22)

The `build` window opens Planet Overview on the home planet, assigns a Builder, queues a Factory, and measures 20s with no input while the bar advances every tick. The three bar variants were measured at `c641c44` with `PERF_WINDOWS=build` and `PERF_BUILD_BAR` (headed, AC power, 5 × 20s, no harness warnings, the bar advanced in every run). Result files: `perf-results/bar2-{none,scalex,width}-{chromium,firefox}.json`. Whole-browser CPU, % of one core, medians, with [min–max]:

| Bar variant | Firefox | Chromium |
| --- | --- | --- |
| `none`: steps at the 5/s tick | **17.0** [16.5–17.4] | **12.4** [11.9–12.8] |
| `scalex`: one-tick `transform: scaleX()` transition | 33.9 [33.2–34.2] (+16.9) | 43.9 [43.4–50.3] (+31.5) |
| `width`: one-tick `width` transition | 89.5 [88.8–89.8] (+72.5) | 57.0 [53.4–63.8] (+44.6) |

- **First decision: step at 5/s (`none`).** Any CSS transition keeps the browser compositing every frame while a build is visible. `scaleX` avoids layout and paint but is still far outside noise of the step in both browsers, so under the review's rule (keep `scaleX` only if its CPU is within noise of no transition in both browsers) the app stepped (`3d0fffe`). In play, the step looked visibly jumpy, so cheaper ways to slide were measured next.

#### Follow-up: blur and a capped frame rate (2026-11-23)

Measured on the working tree after `452fe67`, same settings. Result files: `perf-results/bar3-*.json` and `perf-results/bar4-frames30-*.json`. Whole-browser CPU, % of one core, medians, with [min–max]:

| Bar variant | Firefox | Chromium |
| --- | --- | --- |
| `none`: steps at the 5/s tick (`bar3-none`) | **16.3** [15.0–16.9] | **11.7** [11.3–12.9] |
| `scalex`, Planet Overview panel without `backdrop-blur` (`bar3-scalex-nopanelblur`) | 33.0 [32.6–33.3] (+16.7) | 45.8 [42.0–48.2] (+34.1) |
| `scalex`, every `backdrop-filter` off (`bar3-scalex-noblur`, diagnostic) | 27.5 [27.5–27.7] (+11.2) | 31.6 [31.4–31.8] (+19.9) |
| `frames30`: script-driven slide, written every 4th display frame (`bar4-frames30`) | 31.6 [30.2–32.7] (+15.4) | 27.5 [26.7–27.8] (+15.8) |

- The `none` rows match `bar2-none` within about 1 point, so the machine hadn't drifted.
- Removing the panel's blur changed nothing, so the panel keeps it. Turning off every blur saved only part of the transition's cost: the cost is compositing every frame, and blur only makes each composite dearer.
- `frames30` (requestAnimationFrame, writing `scaleX()` about 30 times a second on whole display frames, sliding over 1.25 ticks so it doesn't pause at late ticks) cost about half of `scalex` in Chromium and nearly all of it in Firefox, and still looked less smooth. The experiment was dropped.
- **Decision: the bar keeps the `scalex` transition.** Smoothness was judged worth +34 CPU points in Chromium and +17 in Firefox while a build is on screen; nothing cheaper looked smooth. `none`, `width`, `frames30` and the `PERF_BUILD_BAR` and `PERF_NO_BLUR` switches were removed, leaving one bar. The `build` window still warns if the bar didn't advance or started no transitions.
- The first run of the three variants (`perf-results/bar-{none,scalex,width}-*.json`) was discarded: the benchmark planet had no Builders, so it made no production and every variant measured the same static bar. The scenario now assigns a Builder first, and the window warns if the bar didn't advance or a transitioning bar started no transitions.
- **Worth watching:** in Firefox pan/zoom the canvas draws about 43 frames per second, with 95th-percentile gaps of 68ms between drawn frames (Chromium: about 64 per second). The scripted pan pauses between moves, which accounts for part of this. If dragging feels less smooth in Firefox, start here.
- **Not a regression:** the game loop's per-call timings (`meanMs`, `p95Ms`) are higher because each call now covers 200ms of game time instead of one frame. Their total per second fell by 66–81%.

## Deferred work

These remain from the Phase 2 list. Each should still be done one at a time and A/B-tested in both browsers with `perf` and `perf:compare`.

- **Static background (step 3): the best next candidate.** Pan/zoom is now the most expensive window (Firefox 77%, Chromium 61%). Every drag frame redraws the whole galaxy layer: the background rect, ~59 hex outlines, ~131 hex labels, 100 stars with `shadowBlur`, and the planets. Options:
  - move the background to its own layer and `cache()` it, or render it once to an image
  - replace `shadowBlur` on stars, planet rings and travel lines
  - show hex labels only above a zoom threshold.
- **Narrower stores (rest of step 2): low priority.** At 5 model updates per second, our JavaScript is about 4–6% of a core, so narrowing the 8 `clientGameModel` subscribers is unlikely to be measurable.
- **Step 4 items, only if numbers call for them:** `Konva.pixelRatio`, hiding off-screen nodes, the layer count, and Firefox-specific canvas settings.
- **Other looping CSS animations.** The paused-game modal's pulsing dots loop while the game is paused, deliberately left as a "waiting" indicator. Other screens (lobby, dialogs, research and trading views) weren't audited. The `dom.runningAnimations` metric and `__perf.snapshot().runningAnimations` (with `?perf=1`) make it quick to check any screen.
- **A paused-game perf window.** Only the server pauses a game (when a player disconnects); there is no user pause action. A paused window would need a second client or a test-only pause hook, and its own budget for the paused modal's pulsing dots, which loop by design. For now the decision to start or stop the fleet animation is unit-tested (`shouldRunFleetAnimation` and `DrawnFleet.canMoveVisibly`); its wiring in `GalaxyCanvas.svelte` is covered only by the idle `rate.fleetAnimation.frame` budget.
- **Hardening the budgets.** They are counters, so they could become hard CI checks (`PERF_ENFORCE_BUDGETS=1`). This needs a CI runner with a headed browser; timing numbers should stay local.

## Open decisions

- **Seeded random generator vs. saved game:** settled in Phase 1. It is a seeded generator, set through the test-only backend route `POST /api/test/galaxy-seed`.
- **What runs in CI:** still open. Timing runs are local and headed. The deterministic budgets are ready to become CI checks (see Deferred work).
