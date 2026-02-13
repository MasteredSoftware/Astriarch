# Copilot instructions for Astriarch

## Big picture architecture
- Monorepo (pnpm workspaces) with engine-first domain logic in packages/astriarch-engine; backend and frontend consume it. See [packages/astriarch-engine/src/index.ts](packages/astriarch-engine/src/index.ts).
- Backend (Express + WebSocket + MongoDB) is authoritative for game state. WebSocket handling lives in [apps/astriarch-backend/src/websocket/WebSocketServer.ts](apps/astriarch-backend/src/websocket/WebSocketServer.ts) and DB models in [apps/astriarch-backend/src/models](apps/astriarch-backend/src/models).
- Frontend (SvelteKit/Vite) uses a WebSocket service and Svelte stores to reflect server state. See [apps/astriarch-frontend/src/lib/services/websocket.ts](apps/astriarch-frontend/src/lib/services/websocket.ts) and [apps/astriarch-frontend/src/lib/stores/gameStore.ts](apps/astriarch-frontend/src/lib/stores/gameStore.ts).

## Game state & messaging conventions
- The engine exposes the authoritative `GameModel` and a filtered `ClientGameModel` for per-player views; server sends client models to each player. See [packages/astriarch-engine/src/engine/clientGameModel.ts](packages/astriarch-engine/src/engine/clientGameModel.ts) and [apps/astriarch-backend/src/websocket/WebSocketServer.ts](apps/astriarch-backend/src/websocket/WebSocketServer.ts).
- Shared WebSocket message contracts live in [packages/astriarch-engine/src/messaging/MessageTypes.ts](packages/astriarch-engine/src/messaging/MessageTypes.ts); add/modify message types there when changing protocols.
- New command/event pipeline is defined in [packages/astriarch-engine/src/engine/GameCommands.ts](packages/astriarch-engine/src/engine/GameCommands.ts) and used by both server and client. Preserve the `commandId`/checksum flow for desync detection.

## Data flow (server ⇄ client)
- Client sends `GAME_COMMAND` messages; server processes via `CommandProcessor`, emits `CLIENT_EVENT` and state updates. See [apps/astriarch-backend/src/controllers/GameControllerWebSocket.ts](apps/astriarch-backend/src/controllers/GameControllerWebSocket.ts).
- Frontend WebSocket service applies events and updates stores; avoid bypassing the store layer when updating UI state. See [apps/astriarch-frontend/src/lib/services/websocket.ts](apps/astriarch-frontend/src/lib/services/websocket.ts).

## Local dev workflows
- Root: `pnpm build`, `pnpm test`, `pnpm lint` run across all workspaces (see [package.json](package.json)).
- Backend: `pnpm --filter astriarch-backend dev` for hot reload (tsx watch). MongoDB expected via `docker-compose up -d mongodb` (see [docker-compose.yml](docker-compose.yml)).
- Frontend: `pnpm --filter astriarch-frontend dev` for Vite/SvelteKit.
- Engine: `pnpm --filter astriarch-engine test` (Jest, runInBand).

## Project-specific conventions
- WebSocket message shapes and type guards are centralized; update both server handlers and frontend service together when adding message types.
- Client model desync checksums are part of the protocol; avoid removing or renaming checksum fields without updating both sides.
- Legacy code in old/ is not part of the current TypeScript stack; prefer editing apps/ and packages/.
