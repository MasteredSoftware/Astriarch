# Performance benchmark

An automated, repeatable measurement of the galaxy view's CPU cost in Chromium and Firefox. It exists so that performance changes are judged by numbers, not impressions. See [performance_improvements_plan.md](../../../../performance_improvements_plan.md) for the plan it supports.

It is separate from the e2e suite: it has its own config (`playwright.perf.config.ts`) and the spec is named `*.perf.ts`, so `test:e2e` never runs it.

## Running it

One-time setup:

```sh
docker-compose up -d mongodb
pnpm --filter astriarch-frontend exec playwright install chromium firefox
```

Run (from the repo root):

```sh
pnpm --filter astriarch-frontend perf            # both browsers
pnpm --filter astriarch-frontend perf:chromium
pnpm --filter astriarch-frontend perf:firefox
```

The config builds the frontend for production, serves it with `vite preview` on port 4174, and starts its own test backend (`NODE_ENV=test`) on port 8032, a port e2e never uses, so an orphaned perf backend can't be reused by e2e. Neither server is reused, so the numbers always come from the current working tree, including the backend and engine. If something already listens on port 8032 (for example an orphaned perf backend), the run fails at start-up; stop it or pick another port with `TEST_BACKEND_PORT`.

The backend uses its own database, `astriarch_v2_perf` (override with `PERF_MONGODB_CONNECTION_STRING`), so perf and e2e can run at the same time: the cleanup before and after a perf run deletes all sessions and the test games, but only in the perf database.

A full run is 5 repetitions × 4 windows of 20s each, about 12 minutes per browser. **A browser window opens on screen. Leave it visible and leave the machine alone while it runs.** For a quick check that the harness works:

```sh
PERF_REPEATS=1 PERF_WINDOW_MS=5000 PERF_WARMUP_MS=3000 PERF_LABEL=smoke pnpm --filter astriarch-frontend perf:chromium
```

To measure only some windows, list them in `PERF_WINDOWS`, e.g. only the `build` window:

```sh
PERF_WINDOWS=build PERF_LABEL=build-check pnpm --filter astriarch-frontend perf
```

Skipped windows are left out of the result file; when you compare it with a full run, `perf:compare` lists the other windows with one side empty, so compare filtered runs with filtered runs. The fleet is still sent whenever `build` runs, so a `build`-only run sees the same game as a full run; the pan/zoom window restores its starting view, so skipping it changes nothing for later windows.

### Comparing build progress bar variants

The build progress bar in Planet Overview can animate three ways (`src/lib/components/game-views/tickProgress.ts`):

- `scalex` (the app's default): a `transform: scaleX()` transition of one tick (200ms), compositor-only
- `width`: the previous `width` transition, which needs layout and paint every frame
- `none`: steps at the 5/s tick with no transition

Only with perf instrumentation on can another variant be chosen: the harness sets `window.__ASTRIARCH_PERF_BUILD_BAR__` from `PERF_BUILD_BAR` before the app loads, and by hand you can add `&perfBuildBar=width` to a `?perf=1` URL. The variant is read once at load. Measure each one in the `build` window, with a label per variant so the result files don't overwrite each other:

```sh
PERF_WINDOWS=build PERF_BUILD_BAR=scalex PERF_LABEL=bar-scalex pnpm --filter astriarch-frontend perf
PERF_WINDOWS=build PERF_BUILD_BAR=width  PERF_LABEL=bar-width  pnpm --filter astriarch-frontend perf
PERF_WINDOWS=build PERF_BUILD_BAR=none   PERF_LABEL=bar-none   pnpm --filter astriarch-frontend perf
pnpm --filter astriarch-frontend perf:compare bar-none-chromium bar-scalex-chromium
pnpm --filter astriarch-frontend perf:compare bar-none-firefox bar-scalex-firefox
```

The result file records the variant as `meta.buildBar`, and the `build` window warns if the bar on screen (its `data-build-bar` attribute) isn't the requested variant. Expect `rate.dom.transitionrun` around 5/s for `scalex` and `width` and about 0 for `none`.

### Options (environment variables)

| Variable                         | Default                                       | Meaning                                                                                             |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PERF_REPEATS`                   | `5`                                           | Repetitions. Each starts a fresh browser and a fresh game                                           |
| `PERF_WINDOW_MS`                 | `20000`                                       | Length of each measurement window                                                                   |
| `PERF_WARMUP_MS`                 | `10000`                                       | Wait after the galaxy renders, before measuring                                                     |
| `PERF_LABEL`                     | (git sha)                                     | Name for the result file, e.g. `baseline` or `fix-fleets`                                           |
| `PERF_HEADLESS`                  | unset                                         | `1` runs headless. The numbers aren't comparable with headed runs                                   |
| `PERF_ENFORCE_BUDGETS`           | unset                                         | `1` fails the run when a budget is exceeded (see below)                                             |
| `PERF_WINDOWS`                   | (all)                                         | Comma list of windows to measure, e.g. `build` or `idle,build`. An unknown name fails the run       |
| `PERF_BUILD_BAR`                 | (app default, `scalex`)                       | Build progress bar variant for the `build` window: `scalex`, `width` or `none` (see below)          |
| `TEST_BACKEND_PORT`              | `8032`                                        | Test backend port. Must be free: the backend is never reused                                        |
| `PERF_MONGODB_CONNECTION_STRING` | `mongodb://localhost:27017/astriarch_v2_perf` | Perf backend database. `MONGODB_CONNECTION_STRING` is not used, so the e2e database is never shared |
| `PERF_FRONTEND_PORT`             | `4174`                                        | `vite preview` port                                                                                 |

## What it measures

Every repetition starts the same pinned game (`BENCHMARK_GAME` in `perfScenario.ts`):

- **Galaxy:** Medium, 4 systems, 6 planets per system, 3 Normal computer opponents, Quick Start.
- **Seed:** a fixed galaxy seed, set through the test-only route `POST /api/test/galaxy-seed`, so every run draws the same map.

Changing `BENCHMARK_GAME` makes old results incomparable with new ones.

After a warm-up, each repetition measures four windows, in this order:

| Window    | What happens                                                                                                                                                                                                                                                                               | Frame sampler                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `idle`    | No input at all                                                                                                                                                                                                                                                                            | Off, so the harness itself adds no rAF loop |
| `panzoom` | Scripted drags and mouse-wheel zooms on the galaxy                                                                                                                                                                                                                                         | On                                          |
| `fleets`  | The home planet's ships are sent to a distant planet; then no input while they travel                                                                                                                                                                                                      | On                                          |
| `build`   | The Planets view (Planet Overview) is opened for the home planet, one citizen is moved to Builders (`BENCHMARK_BUILDERS`) and a Factory (`BENCHMARK_BUILD`) is queued; then no input while it builds and its progress bar advances every tick. The fleet from `fleets` is still in transit | Off, like `idle`                            |

The `build` window runs last, so the queued build can't change what the other windows measure. It warns if no build was queued or the build finished before the window ended. None of the other windows shows a build in progress.

The home planet's citizens all start as Farmers, and a planet with no Builders makes no production: the build would stay at 0 ("999 years") and every bar variant would measure the same static bar. So the scenario assigns a Builder first. The client engine advances `productionCostComplete` every tick, so the bar's target moves every tick (about 0.1% of a Factory per tick). As a guard, the window reads the bar's target fraction (from its inline `scaleX()` or `width`) at its start and end and warns `build progress did not advance during the window` if it didn't rise, and warns when `rate.dom.transitionrun` is under 1/s for the `scalex` or `width` bar. The console prints the bar fraction, the `done/cost` text and the ETA at both ends of the window.

Each window records three kinds of data:

1. **OS-level CPU** for the browser's whole process tree (`cpuSampler.ts`), as % of one core, in total and per process role:
   - Chromium: `renderer`, `gpu`, `utility`, `main`
   - Firefox: `content`, `gpu`, `main`, …

   This is the headline number, and it is measured the same way in both browsers.

2. **In-app instrumentation** (`src/lib/perf/perfMonitor.ts`), which runs only when enabled:
   - timings of the engine clock, store fan-out, canvas update and each Konva layer draw
   - counts of rAF callbacks, store sets and layer draws
   - Konva nodes created and destroyed
   - frame intervals (`panzoom` and `fleets` only), and rendered frames from the Konva draw events (every window).
3. **Chromium only:** Chrome DevTools `Performance.getMetrics`, giving the % of wall time spent in script, layout, style and tasks, and the JS heap size.

Metric names in the results:

| Prefix                  | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpu.*Pct`              | % of one core. Lower is better                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `rate.<name>`           | Events per second, e.g. `rate.canvas.update`, `rate.store.clientGameModel.set`, `rate.konva.draw.galaxy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `time.<name>.msPerSec`  | Milliseconds of that work per wall second: the _load_ it puts on the main thread. `meanMs`, `p95Ms` and `maxMs` are per call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `frames.*`              | rAF frame intervals while the frame sampler runs: `fps`, `p50Ms`, `p95Ms`, `p99Ms`; `periodMs` (the display refresh interval measured by the probe); `droppedPct` (share of display refreshes that got no frame: each interval counts round(interval / period) − 1 dropped frames); `slowOver1_5xPct` (share of intervals longer than 1.5 periods)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `rendered.*`            | Display frames in which at least one Konva layer drew, in every window including `idle`: `fps`, `p50Ms`, `p95Ms`, `maxMs` (intervals between rendered frames). The first draw since the last counted frame arms a one-shot rAF, and every draw before it fires counts as that one frame, so `rendered.fps` never exceeds the display refresh rate and nothing runs while nothing draws. Unlike `frames.fps`, this counts only frames where something was drawn. Schema version 2 files counted draw tasks instead, so their `rendered.*` values aren't comparable. `perf:compare` treats a lower `rendered.fps` as better in `idle` and `fleets`; in `panzoom` the draw rate follows the scripted input, so a significant change there is reported as `changed`, with no direction |
| `konva.*`               | `nodesCreatedPerSec`, `nodesDestroyedPerSec`, `nodeCount`, `registered` (1 when the Konva stage is still attached and every layer on it is instrumented) and `unhookedLayers` (layers added after registration)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `rate.dom.*`            | `rate.dom.transitionrun` and `rate.dom.animationstart`: CSS transitions and CSS animations (Svelte transitions included, as they are CSS keyframes) started per second anywhere in the document, counted from `transitionrun`/`animationstart` capture listeners. They catch a finite animation restarted on every update, e.g. a transition re-triggered by each 5/s tick, which `dom.runningAnimations` can't see. Absent when nothing started (budgets treat that as 0). Web Animations started with `element.animate()` fire neither event and aren't counted                                                                                                                                                                                                                  |
| `dom.runningAnimations` | Infinite CSS/Web animations running at both window start and end (one keeps the browser compositing every frame); finite ones and loops that start mid-window don't count. The snapshot's `loopingAnimations` names them (`runningAnimations` lists all running at the end). Absent without `document.getAnimations`, so its budget is MISSING                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `cdp.*`                 | Chromium DevTools metrics                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Results

Each run writes `perf-results/<label or sha>[-dirty]-<browser>.json`. The file is rewritten after every repetition, so an interrupted run still leaves data behind. It contains:

- run metadata: git sha, branch, dirty flag, browser version, CPU model, viewport, settings, measured refresh rate and device pixel ratio
- every raw window run, including its environment probe (`env`)
- a per-metric summary (median, min, max) across repetitions.

`perf-results/` is git-ignored, because results are only comparable on the same machine.

Compare two runs:

```sh
pnpm --filter astriarch-frontend perf:compare baseline-firefox fix-fleets-firefox
pnpm --filter astriarch-frontend perf:compare baseline-firefox fix-fleets-firefox --all
```

A change is reported as `better` or `worse` only when the two runs' min–max ranges **do not overlap**, meaning the change is larger than the run-to-run noise either side measured. Everything else shows `~` (within noise). A significant change in a metric that has no better direction in that window (`rendered.fps` in `panzoom`) shows `changed` and counts as neither better nor worse. The script warns when the result schema version, browser, machine, seed, settings, refresh rate or device pixel ratio differ between the two files.

## Budgets

`budgets.ts` holds the Phase 2 targets as counters, for example "no Konva nodes created at idle" and "the model advances at most 6 times a second". Counters don't depend on machine speed, so once Phase 2 meets them they can be hard checks, CI included.

For now they are report-only: the run prints PASS, FAIL or MISSING for each budget, and `PERF_ENFORCE_BUDGETS=1` turns a FAIL or MISSING into a failed run. Timing-based numbers are deliberately not budgets, because they are too noisy for CI.

- **Missing metrics fail.** A budget whose metric isn't in the results is MISSING and counts as a violation, so a renamed layer or a lost instrumentation hook can't turn a `max: 0` budget green. Only budgets marked `absentMeansZero: true` (a counter that legitimately disappears when its loop is removed, such as `rate.raf.canvas`) treat absence as 0. Konva layer draw counters are reported as explicit zeros for every registered layer. `konva.registered` is 0 when the stage was never registered, is no longer attached to the document, or has layers added after registration (`konva.unhookedLayers` counts those); the layer draw rates, node churn and `rendered.*` are then left out, so their budgets say MISSING.
- **`rate.dom.transitionrun` and `rate.dom.animationstart` are budgeted at ≤ 1/s in `idle`.** At idle nothing should restart an animation; the odd one-off (e.g. a notification appearing) stays well under 1/s over a 20s window, while a transition restarted every tick reads about 5/s. The limit is an estimate until a recorded run confirms it. In `build` the progress bar's transition is expected, so the rate is recorded but not budgeted.
- **`rate.store.clientGameModel.set` counts every store set**, including the server pushes that `websocket.ts` applies, not only the 200ms tick. That's why its budget is 6/s rather than 5/s.

## Getting trustworthy numbers

- Use the same machine for both sides of a comparison, on AC power, with other heavy apps closed.
- Keep the benchmark browser window visible. Hidden windows get throttled. The harness turns off the browsers' occlusion throttling where it can. Before and after each window (outside the measured interval) it runs a 500ms rAF probe of its own, and adds a warning to the run if either probe ran below 20 rAF/s or below half the run's refresh rate, or if the page wasn't visible at the start or end of the window. The probe after the window catches throttling that began during it. These checks don't depend on what the app does each frame, so they work the same before and after event-driven rendering. Focus isn't checked: Playwright emulates focus, so `document.hasFocus()` stays true for a covered window, and a visible window that isn't focused isn't throttled anyway. Each probe still records `hasFocus` in the run's `env` for diagnosis. It also warns if the game loop ticked below 4/s (it ticks at 5/s), which catches timer throttling, or didn't tick at all, which means the loop stalled or stopped.
- Check the `warnings` array in the results, for example "fleet arrived before the window ended" or "stage did not move during pan/zoom".
- The display refresh rate matters: code that does work on every frame does twice the work on a 120Hz display as on a 60Hz one. The first _clean_ probe's rate is recorded as `meta.refreshHz`, together with `meta.devicePixelRatio`. A probe is clean when the page was visible, rAF ran at least 20 times a second, and it ran at no less than 90% of its own median cadence (so the median is the display's interval, not a throttled one). Dropped frames are judged against `meta.refreshHz` once it is set. Each run's two probes are kept in its `env` field (`start`, `end`), and a run warns if either probe's rate differs from `meta.refreshHz` by more than 10%, or if no clean probe has been seen yet. `perf:compare` warns when the refresh rate, device pixel ratio, warm-up or repetitions differ between the two files. Files written before schema version 2 don't record the refresh rate or pixel ratio; the compare script says "not recorded" for them.
- Timer precision: Chromium coarsens `performance.now()` to about 0.1ms, with jitter; the per-call means are still sound over thousands of samples. The harness disables Firefox's default 1ms clamping (`privacy.reduceTimerPrecision`).
- Limitations of the CPU sampler: work done outside the browser's process tree (e.g. the macOS WindowServer compositor) isn't counted. The CPU time of a process that exits mid-window is lost; this is flagged in the warnings.

## Using the instrumentation by hand

Load the app with `?perf=1` (e.g. `http://localhost:5173/?perf=1`), then in the console:

```js
__perf.reset({ sampleFrames: true }); // start a window
// ...interact...
__perf.snapshot(); // metrics since reset
```

When perf isn't enabled, every hook is a single boolean check.

## Engine micro-benchmark

`packages/astriarch-engine/src/engine/clientGameClock.bench.ts` times `advanceClientGameModelTime` on the same pinned galaxy, both per 60fps frame and per 200ms tick. It separates engine cost from rendering cost.

```sh
pnpm --filter astriarch-engine bench
```

## Profiling to find hotspots (manual)

The harness tells you _whether_ something got better. Profilers tell you _why_.

### Firefox

1. Start the app (`pnpm --filter astriarch-frontend dev`, or the production build via `build` + `preview`) and start a game.
2. Open <https://profiler.firefox.com> and enable the profiler toolbar button. Choose the **Graphics** preset, which records paint and compositing as well as JS.
3. Record 10–20s each of idle and of panning. Look at the call tree for the content process (JS, Konva draws) and at the Renderer/Compositor threads (WebRender).
4. Use **Upload** to get a shareable link to attach to an issue or PR.
5. Check `about:support` → **Graphics**: is **Compositing** WebRender (hardware)? Is **Canvas2D acceleration** on (`gfx.canvas.accelerated`)? Software canvas is a common reason Firefox costs more CPU than Chromium for the same drawing.

### Chromium

DevTools → **Performance** → record. Use the "Bottom-up" view for JS hotspots and the GPU track for raster and compositing cost.
