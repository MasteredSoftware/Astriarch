# Frontend E2E Tests (Playwright)

This directory contains end-to-end tests that run the real frontend in a browser and exercise game flows against the backend WebSocket/API stack.

## Structure

- `fixtures/` shared Playwright fixtures (player contexts/pages)
- `helpers/` reusable domain helpers (lobby setup, game options, in-game assertions)
- `scenarios/` top-level test scenarios
- `perf/` performance benchmark, separate from the e2e suite with its own config (see [perf/README.md](perf/README.md))
- `global-setup.ts` suite-level cleanup before tests
- `global-teardown.ts` suite-level cleanup after tests

## Commands

From repo root:

- `pnpm --filter astriarch-frontend test:e2e`
- `pnpm --filter astriarch-frontend test:e2e:headed`
- `pnpm --filter astriarch-frontend test:e2e:ui`

## Fixture Model

- `fixtures/player.ts` provides isolated browser contexts for named players.
- Use separate player fixtures when validating multiplayer synchronization.
- Keep tests focused on behavior; move repeated interactions into `helpers/`.

## Helper Conventions

- Prefer domain verbs (`openLobby`, `createGame`, `startGame`) over low-level selector calls in scenarios.
- Keep helper waits state-driven (`waitForSelector`, role/testid assertions) instead of fixed sleeps.
- Use test game names prefixed with `__e2e__` so cleanup remains deterministic.

## Data Cleanup

- Tests clean up through backend test route: `POST /api/test/cleanup`.
- Route is only enabled when backend runs with `NODE_ENV=test`.

## Test-Only Backend Routes

All are registered only when the backend runs with `NODE_ENV=test` (see `helpers/cleanup.ts` and `helpers/testBackend.ts`):

- `POST /api/test/cleanup { prefix }` removes `__e2e__`-prefixed games and all sessions.
- `POST /api/test/galaxy-seed { seed | null }` pins (or clears) galaxy generation. The seed is process-wide, so clear it in `afterAll`.
- `POST /api/test/grant-planet { gameName, minHexDistance? }` gives the human player of an in-progress `__e2e__` game the unowned planet nearest its home planet, plus one Scout there. With `minHexDistance` (an integer from 1 to 50; anything else gets a 400), it picks the nearest unowned planet at least that many hexes away. It edits the stored game state directly, so the client must resync (`window.__astriarchTest.requestStateSync()`) to see it. Returns `{ homePlanetId, grantedPlanetId, hexDistance, playerId }`. If no planet qualifies, it responds 500 with `{ error, detail }`, where `detail` is the helper's message (for example "no unowned planet at least 9 hexes from home (farthest is 7)"); `grantPlanet()` includes it in the thrown error.

The Playwright config sets `CORS_ORIGIN_LIST` on the e2e backend to the e2e frontend origin, so lobby HTTP fetches do not log CORS console errors.

Outside CI, `reuseExistingServer` is true, so Playwright reuses any backend already listening on `TEST_BACKEND_PORT`. If that backend was started with `NODE_ENV=test` but without `CORS_ORIGIN_LIST` including the e2e frontend origin (`http://localhost:4173`), lobby fetches log CORS console errors and scenario F fails. Stop that backend first, or start it with `CORS_ORIGIN_LIST=http://localhost:4173`.

## Test Page Hook

Setting `window.__ASTRIARCH_TEST__ = true` in an init script (before the app loads) makes `+layout.svelte` lazily load `src/lib/testing/testHooks.ts`, which installs `window.__astriarchTest` (types in `src/lib/testing/testHooksTypes.ts`). The chunk is built only when `import.meta.env.DEV` is true (`vite dev`, which the e2e config uses) or the build runs with `VITE_ASTRIARCH_TEST_HOOKS=true`; production builds leave it out entirely. It exposes owned planets, the selected planet, mobile ship ids, the Fleet Command destination, fleets in transit (each with its destination planet), task notifications, all starship ids, `requestStateSync()`, `startRecording()` / `stopRecording()`, `waitForMobileShipCount(planetId, count, timeoutMs)`, `waitForOwnedPlanet(planetId, timeoutMs)`, `waitForFleetsInTransitCount(count, timeoutMs)` and `waitForTaskNotification(type, planetId, timeoutMs)`. While recording, it subscribes to `clientGameModel` (no timers) and records each publish as a model sample paired with the Fleet Command DOM after Svelte flushed. All `waitFor*()` methods resolve from a `clientGameModel` subscription (no polling) and reject after a single timeout. Scenarios F and G use them for every model wait. The exception is the wait for `window.__astriarchTest` itself, which runs before the hook exists. The canvas and DOM waits (scenario F's home-planet selection on the canvas, and scenario G's error-page check after a crash) are not model waits.

Port 4173 is also Vite's default `vite preview` port. Outside CI, Playwright reuses a server already listening there, so a stray `vite preview` of a production build has no hook and scenario F fails at the hook wait. Stop it and rerun.

## Scenario F (issue #80) Variants and Failure Messages

`scenarios/scenario-f-fleet-landing-view.spec.ts` lands a Scout on the planet open in Fleet Command and compares model and view on every tick. It runs as named variants, one test each (title suffix `[name]`; filter with `-g <name>`):

- `baseline`: seed 20261125, the nearest unowned planet (1 hex), Send clicked immediately.
- `far-at-advance`: seed 20260101, a planet 3 hexes away, Send timed so the client lands about 100ms after a host `ADVANCE_GAME_TIME` send (inside the advance round trip).

On Very Fast, a flight takes exactly `hexDistance x 10s`, and the host sends `ADVANCE_GAME_TIME` every 10s. So a longer flight lands at the same point in the advance interval as it was sent. Only the Send time changes that, which is why `far-at-advance` waits before clicking Send.

Seeds and distances are pinned in `apps/astriarch-backend/src/utils/testScenarios.spec.ts`, so galaxy generation drift fails there first. Keep that table in step with the spec's variant lists.

For a wider local soak (three seeds; the nearest planet plus 3-hex flights landing at -250, 0, 100, 250 and 5000ms from an advance; 18 variants), run:

```sh
SCENARIO_F_SOAK=1 TEST_BACKEND_PORT=8022 pnpm --filter astriarch-frontend exec playwright test e2e/scenarios/scenario-f-fleet-landing-view.spec.ts --retries=0
```

Use `--retries=0` so an intermittent reproduction is not hidden by a retry. Add `--repeat-each=N` for more runs. The soak never runs in CI.

Each test attaches `fleet-landing-timeline-<variant>.json` (samples, websocket frames, console output, and `launchWallMs`, `projectedLandingMs`, `fleetLaunchedRecvMs`, `advanceSentMs`, `achievedOffsetMs`). `achievedOffsetMs` is the time from the nearest host `ADVANCE_GAME_TIME` send to the first sample showing the landed ship. It is recorded, not asserted, because the tick grain and click latency blur the aim by a few hundred ms. If it is more than 1s from the target (mod 10s), the test gets a `phase-miss` annotation. That is informational and does not fail the test.

Failure messages start with `[variant <name> seed=... minHex=... hex=... targetOffset=... achievedOffset=...]`:

- `SELECTION BUG at seq k ...` means Fleet Command's selected planet, or the planet it showed, moved off the watched planet during recording. It is listed first because it can cause follow-on VIEW or SYNC lines.
- `VIEW BUG at seq k: model [...] view [...]` means the store had the ships but the rendered ship cards did not. Nearby websocket frames are listed.
- `VIEW BUG: model reached N ships at seq k but the view never did` means the model showed the landed ship but no ship card for it ever rendered (the view must match the model on every sample; there is no lag tolerance).
- `SYNC BUG: model dropped ... after <frame>` means the model had the landed ship and then lost it. The last server frame before the drop is named.
- Checksum mismatches, "Fleet data refreshed" resyncs, page errors, `each_key_duplicate` and any console error also fail the test. The console-error allowlist is empty on purpose.

Scenarios F and G pick the destination with `clickDestinationPlanet()` (`helpers/fleetScenario.ts`). If the canvas click picks a different planet, setup fails at once with `wrong destination: expected planet X, got Y` (and a `wrong-destination-X.png` screenshot) instead of a later landing or capture timeout. After Send, `expectFleetHeadedTo()` checks the fleet in transit is headed to the intended planet. When the destination has to be dragged into view, the drag starts at the first sampled canvas point no overlay covers; if every sample is covered, setup fails with a `planet-X-no-drag-start.png` screenshot.

## Scenario G (issue #83): Capturing an Enemy Planet

`scenarios/scenario-g-capture-large-fleet.spec.ts` sends a large mixed fleet (47 ships: 10 Scouts, 10 Destroyers, 15 Cruisers, 12 Battleships; strength 744) to the Easy AI's home planet T and captures it. Issue #83 was a Svelte `each_key_duplicate` thrown at that point. SvelteKit's route error boundary caught it and replaced the whole game with its default error page ("500 / Internal Error").

The cause was the task notification key. `TaskNotificationPanel` keyed tasks by `type + planetId`, and `TaskNotificationType` is a numeric enum, so the key was a sum. A captured planet always gets an empty build queue, so (BuildQueueEmpty = 0, T) has key `T`. That collides with (CitizensProtesting = 2, T-2), (InsufficientFood = 1, T-1), and so on. The key is now the string `` `${type}:${planetId}` `` (`src/lib/components/astriarch/notification/taskNotificationList.ts`).

The scenario sets the game up through the test-only route `POST /api/test/setup-fleet-attack { gameName, scouts?, destroyers?, cruisers?, battleships? }`. Each count is an integer from 0 to 200; anything else gets a 400. Use `setupFleetAttack()` in `helpers/testBackend.ts`. With seed 20261125 (2 systems x 4 planets), the route:

- gives the human the staging planet S = T+2, holding the fleet
- gives the AI planet R = T+1, so capturing T does not destroy the AI and end the game
- gives the human planet C = T-2 and sets every citizen there protesting (with a food buffer)

S and R are in T's system only because T is the first planet of its system for this seed; C is in the human's home system.

The route edits the stored game directly, so the client must resync afterwards. The layout (T = H+4, and the S to T distance) is pinned in `apps/astriarch-backend/src/utils/testFleetAttackScenario.spec.ts`.

C is seeded with protest because the protest on a freshly captured planet is random (each citizen has a 1 in 3 chance of being content), and gameplay randomness is not seeded. With protest on C, its task (CitizensProtesting, C) has the old key (T-2)+2 = T. So the collision with T's BuildQueueEmpty task is certain. It does not depend on chance.

The test fails immediately with `ISSUE #83: each_key_duplicate after capturing planet T: <error>`. The message continues with `PAGE CRASHED: ...` if the game UI was replaced by the error page; a screenshot is saved as `issue-83-crash.png`. After a capture without errors, it checks:

- the game UI (`view-game`) is still rendered
- a `PLANET_CAPTURED` event arrived and no fleet is left in transit
- ship ids are unique, and Fleet Command on T shows exactly the model's ships
- the task panel renders each (type, planet) once and matches the model
- there are no page errors, console errors (empty allowlist) or fleet resyncs

It attaches `scenario-g-timeline.json`, which holds the setup result, websocket frames and client events, console output, task snapshots before and after, and Fleet Command samples recorded from Send onwards. If `each_key_duplicate` fired, it also adds an `issue-80-observation` annotation. That annotation says what the Fleet Command view did after the error.

The test page hook also exposes `taskNotifications()`, which lists (type, planetId) pairs in panel order, and `allStarshipIds()`, which covers every owned planet's ships plus fleets in transit. Task items carry `data-testid="task-item"`, `data-task-type` and `data-planet-id`.

## data-testid Contract

The scenarios rely on these stable selectors:

- `show-lobby-btn`
- `view-lobby`
- `view-game-options`
- `view-game`
- `connection-status`
- `create-game-btn`
- `game-item-<gameId>`
- `join-game-btn`
- `resume-game-btn`
- `game-name-input`
- `player-name-input`
- `opponent-slot-1`
- `opponent-slot-2`
- `opponent-slot-3`
- `start-game-btn`
- `send-ships-btn`
- `notification-error`
- `view-fleet-command` (with `data-selected-planet-id`, the planet Fleet Command is showing)
- `ship-card` (with `data-ship-id`, one per rendered ship in Fleet Command)
- `task-item` (with `data-task-type` and `data-planet-id`, one per rendered task notification)

When changing UI components, preserve these ids or update helpers/scenarios in the same change.
