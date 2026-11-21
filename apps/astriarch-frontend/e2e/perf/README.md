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

The config builds the frontend for production, serves it with `vite preview` on port 4174, and starts a test backend (`NODE_ENV=test`) on port 8002. If port 8002 is in use, pick another port with `TEST_BACKEND_PORT=8022`.

A full run is 5 repetitions × 3 windows of 20s each, about 10 minutes per browser. **A browser window opens on screen. Leave it visible and leave the machine alone while it runs.** For a quick check that the harness works:

```sh
PERF_REPEATS=1 PERF_WINDOW_MS=5000 PERF_WARMUP_MS=3000 PERF_LABEL=smoke pnpm --filter astriarch-frontend perf:chromium
```

### Options (environment variables)

| Variable               | Default   | Meaning                                                           |
| ---------------------- | --------- | ----------------------------------------------------------------- |
| `PERF_REPEATS`         | `5`       | Repetitions. Each starts a fresh browser and a fresh game         |
| `PERF_WINDOW_MS`       | `20000`   | Length of each measurement window                                 |
| `PERF_WARMUP_MS`       | `10000`   | Wait after the galaxy renders, before measuring                   |
| `PERF_LABEL`           | (git sha) | Name for the result file, e.g. `baseline` or `fix-fleets`         |
| `PERF_HEADLESS`        | unset     | `1` runs headless. The numbers aren't comparable with headed runs |
| `PERF_ENFORCE_BUDGETS` | unset     | `1` fails the run when a budget is exceeded (see below)           |
| `TEST_BACKEND_PORT`    | `8002`    | Test backend port                                                 |
| `PERF_FRONTEND_PORT`   | `4174`    | `vite preview` port                                               |

## What it measures

Every repetition starts the same pinned game (`BENCHMARK_GAME` in `perfScenario.ts`):

- **Galaxy:** Medium, 4 systems, 6 planets per system, 3 Normal computer opponents, Quick Start.
- **Seed:** a fixed galaxy seed, set through the test-only route `POST /api/test/galaxy-seed`, so every run draws the same map.

Changing `BENCHMARK_GAME` makes old results incomparable with new ones.

After a warm-up, each repetition measures three windows:

| Window    | What happens                                                                          | Frame sampler                               |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| `idle`    | No input at all                                                                       | Off, so the harness itself adds no rAF loop |
| `panzoom` | Scripted drags and mouse-wheel zooms on the galaxy                                    | On                                          |
| `fleets`  | The home planet's ships are sent to a distant planet; then no input while they travel | On                                          |

Each window records three kinds of data:

1. **OS-level CPU** for the browser's whole process tree (`cpuSampler.ts`), as % of one core, in total and per process role:
   - Chromium: `renderer`, `gpu`, `utility`, `main`
   - Firefox: `content`, `gpu`, `main`, …

   This is the headline number, and it is measured the same way in both browsers.

2. **In-app instrumentation** (`src/lib/perf/perfMonitor.ts`), which runs only when enabled:
   - timings of the engine clock, store fan-out, canvas update and each Konva layer draw
   - counts of rAF callbacks, store sets and layer draws
   - Konva nodes created and destroyed
   - frame intervals.
3. **Chromium only:** Chrome DevTools `Performance.getMetrics`, giving the % of wall time spent in script, layout, style and tasks, and the JS heap size.

Metric names in the results:

| Prefix                  | Meaning                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpu.*Pct`              | % of one core. Lower is better                                                                                                                                 |
| `rate.<name>`           | Events per second, e.g. `rate.canvas.update`, `rate.store.clientGameModel.set`, `rate.konva.draw.galaxy`                                                       |
| `time.<name>.msPerSec`  | Milliseconds of that work per wall second: the _load_ it puts on the main thread. `meanMs`, `p95Ms` and `maxMs` are per call                                   |
| `frames.*`              | Frame intervals: `fps`, `p50Ms`, `p95Ms`, `p99Ms`, and `over16_7Pct`/`over33_3Pct` (the share of frames slower than 60/30 fps)                                 |
| `konva.*`               | `nodesCreatedPerSec`, `nodesDestroyedPerSec`, `nodeCount`                                                                                                      |
| `dom.runningAnimations` | CSS/Web animations running when the window ends (an infinite one keeps the browser compositing every frame). The raw snapshot's `runningAnimations` names them |
| `cdp.*`                 | Chromium DevTools metrics                                                                                                                                      |

## Results

Each run writes `perf-results/<label or sha>[-dirty]-<browser>.json`. The file is rewritten after every repetition, so an interrupted run still leaves data behind. It contains:

- run metadata: git sha, branch, dirty flag, browser version, CPU model, viewport, settings
- every raw window run
- a per-metric summary (median, min, max) across repetitions.

`perf-results/` is git-ignored, because results are only comparable on the same machine.

Compare two runs:

```sh
pnpm --filter astriarch-frontend perf:compare baseline-firefox fix-fleets-firefox
pnpm --filter astriarch-frontend perf:compare baseline-firefox fix-fleets-firefox --all
```

A change is reported as `better` or `worse` only when the two runs' min–max ranges **do not overlap**, meaning the change is larger than the run-to-run noise either side measured. Everything else shows `~` (within noise). The script warns when the browser, machine, seed or settings differ between the two files.

## Budgets

`budgets.ts` holds the Phase 2 targets as counters, for example "no Konva nodes created at idle" and "the model advances at most 5 times a second". Counters don't depend on machine speed, so once Phase 2 meets them they can be hard checks, CI included.

For now they are report-only: the run prints PASS/FAIL for each budget, and `PERF_ENFORCE_BUDGETS=1` turns a FAIL into a failed run. Timing-based numbers are deliberately not budgets, because they are too noisy for CI.

## Getting trustworthy numbers

- Use the same machine for both sides of a comparison, on AC power, with other heavy apps closed.
- Keep the benchmark browser window visible. Hidden windows get throttled. The harness turns off the browsers' occlusion throttling where it can, and adds a warning to a run if the game loop ticked below 4/s (it ticks at 5/s) or frames ran below 20/s.
- Check the `warnings` array in the results, for example "fleet arrived before the window ended" or "stage did not move during pan/zoom".
- Note the display refresh rate. The current code does work on every frame, so a 120Hz display does twice the work of a 60Hz one. `frames.fps` in the `panzoom`/`fleets` windows shows the rate the run saw.
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
