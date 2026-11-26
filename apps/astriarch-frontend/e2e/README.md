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
- `POST /api/test/grant-planet { gameName }` gives the human player of an in-progress `__e2e__` game the unowned planet nearest its home planet, plus one Scout there. It edits the stored game state directly, so the client must resync (`window.__astriarchTest.requestStateSync()`) to see it. Returns `{ homePlanetId, grantedPlanetId, hexDistance, playerId }`.

The Playwright config sets `CORS_ORIGIN_LIST` on the e2e backend to the e2e frontend origin, so lobby HTTP fetches do not log CORS console errors.

Outside CI, `reuseExistingServer` is true, so Playwright reuses any backend already listening on `TEST_BACKEND_PORT`. If that backend was started with `NODE_ENV=test` but without `CORS_ORIGIN_LIST` including the e2e frontend origin (`http://localhost:4173`), lobby fetches log CORS console errors and scenario F fails. Stop that backend first, or start it with `CORS_ORIGIN_LIST=http://localhost:4173`.

## Test Page Hook

Setting `window.__ASTRIARCH_TEST__ = true` in an init script (before the app loads) makes `+layout.svelte` lazily load `src/lib/testing/testHooks.ts`, which installs `window.__astriarchTest` (types in `src/lib/testing/testHooksTypes.ts`). Production never fetches that chunk. It exposes owned planets, the selected planet, mobile ship ids, fleets in transit, `requestStateSync()`, and `startRecording()` / `stopRecording()`. While recording, it subscribes to `clientGameModel` (no timers) and records each publish as a model sample paired with the Fleet Command DOM after Svelte flushed.

## Scenario F (issue #80) Failure Messages

`scenarios/scenario-f-fleet-landing-view.spec.ts` lands a Scout on the planet open in Fleet Command and compares model and view on every tick. It always attaches `fleet-landing-timeline.json` (samples, websocket frames, console output).

- `VIEW BUG at seq k: model [...] view [...]` means the store had the ships but the rendered ship cards did not. Nearby websocket frames are listed.
- `VIEW BUG: model reached N ships at seq k but the view ...` means the cards lagged more than 2 ticks behind the model.
- `SYNC BUG: model dropped ... after <frame>` means the model had the landed ship and then lost it. The last server frame before the drop is named.
- Checksum mismatches, "Fleet data refreshed" resyncs, page errors, `each_key_duplicate` and any console error also fail the test. The console-error allowlist is empty on purpose.

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

When changing UI components, preserve these ids or update helpers/scenarios in the same change.
