# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Astriarch is a space strategy game built as a TypeScript monorepo using pnpm workspaces. The game features real-time multiplayer gameplay with a Node.js backend and multiple frontend implementations.

## Architecture
The project follows a monorepo structure with clear separation of concerns:

- **packages/astriarch-engine**: Core game engine with business logic, game state management, and turn-based mechanics. Provides TypeScript types and game controllers used across all applications.
- **apps/astriarch-backend**: Express.js server with WebSocket support, MongoDB integration, and session management. Handles multiplayer game state and real-time communication.
- **apps/astriarch-frontend-sveltekit**: Primary SvelteKit frontend with component library, game canvas using Konva, and real-time multiplayer UI.
- **packages/astriarch-ui**: Shared React component library using Chakra UI for consistent styling across frontends.

The engine exports game models, controllers, and messaging types that are consumed by both frontend and backend applications. The backend maintains authoritative game state while clients receive filtered views through the ClientGameModel.

## Development Commands

### Root Level (run from project root)
- `pnpm build` - Build all packages and apps
- `pnpm test` - Run tests across all workspaces  
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code across all packages
- `docker-compose up -d mongodb` - Start local MongoDB for development

### Backend Development
- `pnpm --filter astriarch-backend dev` - Start backend in development mode with hot reload
- `pnpm --filter astriarch-backend build` - Build backend TypeScript to JavaScript
- `pnpm --filter astriarch-backend test` - Run backend tests
- `pnpm --filter astriarch-backend lint` - Lint backend code
- `pnpm --filter astriarch-backend type-check` - Run TypeScript type checking

### SvelteKit Frontend Development  
- `pnpm --filter astriarch-frontend-sveltekit dev` - Start SvelteKit dev server
- `pnpm --filter astriarch-frontend-sveltekit build` - Build SvelteKit app
- `pnpm --filter astriarch-frontend-sveltekit test` - Run Vitest unit tests
- `pnpm --filter astriarch-frontend-sveltekit lint` - Lint and format check
- `pnpm --filter astriarch-frontend-sveltekit storybook` - Start Storybook component development

### Engine Package Development
- `pnpm --filter astriarch-engine build` - Build engine package  
- `pnpm --filter astriarch-engine test` - Run engine unit tests
- `pnpm --filter astriarch-engine lint` - Lint engine code

## Key Technical Details

### Game State Management
- Game state is managed centrally in the astriarch-engine package
- Backend maintains authoritative GameModel, clients receive filtered ClientGameModel
- Real-time updates flow through WebSocket connections managed by the backend
- Game timing: MS_PER_TICK (200ms) for client updates, MS_PER_CYCLE_DEFAULT (30s) for game turns

### Database
- MongoDB is used for persistent game state and session management
- Start local MongoDB with `docker-compose up -d mongodb` for development
- Connection configuration in backend's config/ directory

### WebSocket Communication
- Real-time multiplayer uses WebSocket connections through the backend's WebSocketServer
- Message types are defined in packages/astriarch-engine/src/messaging/MessageTypes
- Frontend websocket service handles connection management and message routing

### Testing
- Backend uses Jest for unit testing
- SvelteKit frontend uses Vitest for component and unit testing  
- Engine package has comprehensive Jest test suite
- Run individual package tests with `pnpm --filter <package-name> test`

## Current Branch Status
- Working on v2.x-svelte branch (SvelteKit migration)
- Main branch for PRs: master
- Recent development focuses on WebSocket multiplayer implementation and SvelteKit frontend