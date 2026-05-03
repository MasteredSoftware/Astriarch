# Frontend E2E Tests (Playwright)

This directory contains end-to-end tests that run the real frontend in a browser and exercise game flows against the backend WebSocket/API stack.

## Structure

- `fixtures/` shared Playwright fixtures (player contexts/pages)
- `helpers/` reusable domain helpers (lobby setup, game options, in-game assertions)
- `scenarios/` top-level test scenarios
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

When changing UI components, preserve these ids or update helpers/scenarios in the same change.
