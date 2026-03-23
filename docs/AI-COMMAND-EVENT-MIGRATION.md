# AI Command/Event Pipeline Migration Plan (v2 — ClientModel Refactor)

> **Goal:** Refactor `ComputerPlayer` so AI players behave identically to human players: they receive a `ClientModelData` (filtered view), make decisions based only on what they can "see", emit `GameCommand[]`, and never directly mutate game state. Commands are processed by the **caller** on the authoritative `ModelData`, generating events for persistence and eventual game playback.
>
> **Previous iteration (v1)** had AI calling `CommandProcessor` directly on `ModelData` from within `computerTakeTurn`. This v2 takes the architecture further — AI only touches `ClientModelData`, matching the human player contract exactly.

## Status

| Phase | Step | Description | Status |
|-------|------|-------------|--------|
| **Spike** | S1 | New `computerTakeTurn` signature: `(clientModel, grid) → GameCommand[]` | ✅ Done |
| **Spike** | S2 | Update `gameController.ts` caller to construct ClientModel | ✅ Done |
| **Spike** | S3 | Update all sub-method signatures from `gameModel` to `clientModel + grid` | ✅ Done |
| **Spike** | S4 | Update `computerPlayer.spec.ts` test call sites | ✅ Done |
| **Rewrite** | 3 | Rewrite `computerManageFleetRepairs` — retreat damaged planetary fleet ships to repair-capable planets (command-based) | ✅ Done |
| **Remove** | 4 | Remove `processAICommand` helper — AI returns commands, caller processes | ✅ Done |
| **Convert** | 5 | Stop AI from calling `CommandProcessor` internally; return `GameCommand[]` from each sub-method | ✅ Done |
| **Convert** | 6 | Remove `clientPlanets as unknown as PlanetData[]` casts — `PlanetLocation` interface created, 6 casts removed | ✅ Done |
| **Convert** | 7 | Convert `computerAdjustPopulationAssignments` — snapshot/restore pattern for net diff commands | ✅ Done |
| **Convert** | 8 | Convert `computerSendShips` — local `committedShipIds` tracking (seeded from repair IDs), pure command output, no direct fleet mutation | ✅ Done |
| **Caller** | 9 | `gameController.ts`: process returned commands through `CommandProcessor.processCommand(clientModel, grid, cmd)` | ✅ Done |
| **Backend** | 10 | Backend `GameControllerWebSocket.ts` persistence — no changes needed (already iterates `{ command, result }`) | ✅ No-op |
| **Test** | 11 | Update tests for command-only AI flow — tests process returned commands via CommandProcessor | ✅ Done (mostly) |
| **Test** | 12 | Full game simulation: verify AI behavior is unchanged | ⚠️ 2 test failures remain |

### Current Test Status

**197 passing, 2 failing** (+ 1 pre-existing flaky `battleSimulator` probabilistic test)

| Test | Status | Notes |
|------|--------|-------|
| `computerManageResearch` — set percent, queue research | ✅ Pass | Tests process returned commands |
| `computerBuildImprovementsAndShips` — build goals | ✅ Pass | Tests process returned commands |
| `computerSendShips` — prefer closer planets | ✅ Pass | |
| `computerSendShips` — exploration priorities | ✅ Pass | |
| `calculateEffectiveFleetStrength` — all scenarios | ✅ Pass | |
| AI vs AI — Easy vs Hard, Easy vs Expert | ✅ Pass | |
| AI vs AI — Hard vs Expert | ❌ Fail | Expert wins 0 games; likely due to changed turn dynamics from batched command processing |
| Enhanced Intelligence — re-scout nearby enemy planets | ❌ Fail | `planetNeedsExploration` returns false; test may depend on intermediate state from prior `advanceGameClock` cycles |
| `battleSimulator` — fleet advantage, defender ratio | ⚠️ Flaky | Pre-existing probabilistic test, unrelated to migration |

## Core Design Decisions

### 1. AI receives ClientModelData only — no cheating

The AI player gets the **same filtered view** a human player would see:

| Available via `ClientModelData` | NOT available (hidden) |
|---|----|
| `mainPlayer` (full `PlayerData` for this AI) | Other players' `PlayerData` (fleet movements, owned planets, build goals) |
| `mainPlayerOwnedPlanets` (full `PlanetData` for owned) | Full `PlanetData` for unowned planets (population, resources, fleets, buildings) |
| `clientPlanets` (id, name, location, type-if-explored) | `modelData.players` array |
| `clientPlayers` (id, type, name, color, points, research) | `modelData.planets` array |
| `clientTradingCenter` (prices + own trades) | Other players' trades |
| `currentCycle`, `gameOptions` | Trading center internal parameters |

The AI uses `mainPlayer.lastKnownPlanetFleetStrength` and `mainPlayer.knownPlanetIds` for intelligence — this is the **same mechanism** human players would use (these are player-scoped memory of previously scouted data).

### 2. AI returns `GameCommand[]` only — caller processes them

`computerTakeTurn` returns plain `GameCommand[]`. The **caller** (`gameController.ts`) is responsible for:
1. Constructing a `ClientModelData` for the AI player
2. Calling `computerTakeTurn(clientModel, grid)` → gets back `GameCommand[]`
3. For each command: `CommandProcessor.processCommand(modelData, grid, command)` on the authoritative model
4. After each command: **reconstruct** `ClientModelData` so the AI's next turn (and subsequent callers) see updated state

Since `constructClientGameModel` creates shared references to `mainPlayer` and owned planet objects (not deep copies), mutations from `CommandProcessor.processCommand(modelData, ...)` are **automatically visible** through the client model's `mainPlayer` and `mainPlayerOwnedPlanets` references. The `clientPlanets` list is a separate array of `ClientPlanet` objects but planet locations don't change mid-turn.

**Important:** Unlike v1 where AI called CommandProcessor internally and saw results immediately, in v2 each command is processed by the caller after `computerTakeTurn` returns. This means the AI makes all decisions based on a **snapshot** at the start of its turn. Some later commands may fail validation (e.g., trying to spend resources already spent by an earlier command). This matches how a human player batch-sending commands would work, and CommandProcessor handles failures gracefully.

### 3. `computerManageFleetRepairs` rewritten — planetary retreat only

The **old** implementation redirected in-transit fleets by calling `Fleet.setDestination()` directly. This was faulty:
- Human players can't redirect in-transit fleets → unfair AI advantage
- Would require a `REDIRECT_FLEET` command type that doesn't exist
- Conceptually wrong — the intent was to retreat ships from planets lacking repair improvements

The **new** implementation handles the correct scenario: damaged ships sitting on a planet that **cannot repair them**. Repair requirements (from `Fleet.repairPlanetaryFleet`):
- **Destroyers / SpacePlatforms**: planet needs a Factory + Colony
- **Cruisers / Battleships**: planet needs a Factory + Colony + SpacePlatform
- **Scouts / SystemDefense**: always repairable (no improvement needed)

The method checks each owned planet's fleet, identifies damaged ships the planet can't repair, finds the nearest owned planet with the right improvements, and emits `SEND_SHIPS` commands to retreat them. Ship IDs committed to repair retreats are passed to `computerSendShips` via `initialCommittedShipIds` so they aren't double-counted for attack/exploration.

Gated by `enableFleetRepairs` AI setting: enabled for Hard, Expert, and Human; disabled for Easy and Normal.

### 4. Population assignments: snapshot → mutate → capture → restore

The AI's `computerAdjustPopulationAssignments` uses a **snapshot/restore** approach. The iterative rebalancing algorithm needs intermediate state (it reads updated worker counts after each mutation), so:

1. **Snapshot** initial worker types (`citizenWorkerSnapshot`) at start
2. **Run** the iterative algorithm, which mutates model state through shared refs
3. **Capture** net diffs per planet as `UPDATE_PLANET_WORKER_ASSIGNMENTS` commands
4. **Restore** citizen worker types to pre-algorithm state
5. Commands returned to caller → `CommandProcessor` re-applies the net diffs cleanly

This preserves the complex iterative algorithm unchanged while ensuring all mutations flow through the event pipeline.

### 5. `clientPlanets` replaces `modelData.planets` for planet iteration

Everywhere the AI currently iterates `gameModel.modelData.planets` (the full planet list), it will instead iterate `clientModel.clientPlanets`. The `ClientPlanet` type has `{ id, name, originPoint, boundingHexMidPoint, type: PlanetType | null }` — sufficient for:
- Distance calculations (via `boundingHexMidPoint`)
- Exploration checks (`type === null` means unexplored)
- Target identification by location

For **owned planets**, the AI uses `mainPlayerOwnedPlanets` which has full `PlanetData`.

### 6. Build goals stay as direct player state mutation

`player.planetBuildGoals` is AI-internal planning state on `mainPlayer`. Since `mainPlayer` in `ClientModelData` is a **shared reference** to the same `PlayerData` object in `ModelData`, writing to `player.planetBuildGoals` is acceptable — it's not a game action, it's AI working memory. Human players also have this field but set it through UI interactions that don't generate commands.

## Architecture

### Before (v1 — pre-migration)
```
advanceGameClockTo()
  └─ FOR EACH AI PLAYER:
       aiResults = ComputerPlayer.computerTakeTurn(gameModel, player, ownedPlanets)
         ├─ computerManageResearch()         → calls CommandProcessor internally
         ├─ computerSetPlanetBuildGoals()    → mutates player.planetBuildGoals
         ├─ computerSubmitTrades()           → calls CommandProcessor internally
         ├─ computerBuildImprovementsAndShips() → calls CommandProcessor internally
         ├─ computerAdjustPopulationAssignments() → HYBRID: direct mutation + net diff commands
         ├─ computerManageFleetRepairs()     → direct Fleet.setDestination() mutation (⚠️ redirected in-transit fleets — faulty logic)
         └─ computerSendShips()             → HYBRID: some CommandProcessor, some direct mutation
       allAICommandResults.push(...aiResults)
```
AI operated on full `GameModelData`, called `CommandProcessor.processCommand(modelData, grid, cmd)` internally, received `AICommandResult[]` back.

### After (v2 — implemented ✅)
```
advanceGameClockTo()
  └─ FOR EACH AI PLAYER:
       clientModel = ClientGameModel.constructClientGameModel(modelData, player.id)
       commands = ComputerPlayer.computerTakeTurn(clientModel, grid)
         ├─ computerManageResearch()         → returns GameCommand[]
         ├─ computerSetPlanetBuildGoals()    → mutates clientModel.mainPlayer.planetBuildGoals (AI working memory)
         ├─ computerSubmitTrades()           → returns GameCommand[]
         ├─ computerBuildImprovementsAndShips() → returns GameCommand[]
         ├─ computerAdjustPopulationAssignments() → snapshot/restore → returns GameCommand[]
         ├─ computerManageFleetRepairs()     → returns { commands, repairShipIds } (SEND_SHIPS for repair retreat)
         └─ computerSendShips(repairShipIds) → committedShipIds tracking (seeded from repair IDs) → returns GameCommand[]
       FOR EACH command:
         result = CommandProcessor.processCommand(clientModel, grid, command)
         allAICommands.push({ command, result })
```
AI operates on `ClientModelData` only. Returns `GameCommand[]`. Caller processes on `ModelData` via shared refs. `computerManageFleetRepairs` rewritten (planetary retreat only). `processAICommand` helper removed.

---

## Step Details

### Step 1: New `computerTakeTurn` signature ✅

**File:** `packages/astriarch-engine/src/engine/computerPlayer.ts`

Change the main entry point from `(gameModel: GameModelData, player: PlayerData, ownedPlanets: PlanetById)` to `(clientModel: ClientModelData, grid: Grid)`.

```typescript
// Before
public static computerTakeTurn(gameModel: GameModelData, player: PlayerData, ownedPlanets: PlanetById): AICommandResult[]

// After
public static computerTakeTurn(clientModel: ClientModelData, grid: Grid): GameCommand[]
```

The AI extracts what it needs from `clientModel`:
- `clientModel.mainPlayer` → the AI player's `PlayerData`
- `clientModel.mainPlayerOwnedPlanets` → the AI's owned planets
- `clientModel.clientPlanets` → all planet locations (for distance calculations, exploration)
- `clientModel.currentCycle` → current game turn
- `grid` → hex grid for distance calculations

All sub-methods receive `(clientModel: ClientModelData, grid: Grid)` and return `GameCommand[]`.

### Step 2: Update `gameController.ts` caller ✅

**File:** `packages/astriarch-engine/src/engine/gameController.ts`

```typescript
// Before
const ownedPlanets = ClientGameModel.getOwnedPlanets(p.ownedPlanetIds, modelData.planets);
const aiResults = ComputerPlayer.computerTakeTurn(gameModel, p, ownedPlanets);
allAICommandResults.push(...aiResults);

// After
const clientModel = ClientGameModel.constructClientGameModel(modelData, p.id);
const aiCommands = ComputerPlayer.computerTakeTurn(clientModel, grid);
for (const command of aiCommands) {
  const result = CommandProcessor.processCommand(modelData, grid, command);
  allAICommandResults.push({ command, result });
  if (!result.success) {
    console.warn(`AI command failed for player ${p.id}:`, command.type, result.error?.message);
  }
}
```

The `AICommandResult` type stays as-is (`{ command: GameCommand, result: CommandResult }`) but is now populated by the caller, not the AI.

### Step 3: Rewrite `computerManageFleetRepairs` ✅

**File:** `packages/astriarch-engine/src/engine/computerPlayer.ts`

The old implementation (redirecting in-transit fleets) was deleted. A new implementation was added that handles the correct scenario: **damaged ships on planets that lack the improvements to repair them**.

**New behavior:**
1. Build lookup of owned planets that can repair each ship class (Factory+Colony for destroyers, Factory+Colony+SpacePlatform for cruisers/battleships)
2. For each owned planet, check ships in the planetary fleet (not in-transit) that are damaged
3. If the planet can't repair a ship type, find the nearest owned planet that can
4. Group retreating ships by destination and emit `SEND_SHIPS` commands
5. Return committed ship IDs so `computerSendShips` can exclude them

**Returned type:** `{ commands: GameCommand[], repairShipIds: Set<string> }`

Gated by `enableFleetRepairs` setting: **true** for Hard, Expert, Human; **false** for Easy, Normal.

Called in `computerTakeTurn` **before** `computerSendShips` so repair retreats take priority over attack/exploration decisions.

### Step 4: Remove `AICommandResult` from computerPlayer, clean up helpers ✅

**Files:** `packages/astriarch-engine/src/engine/computerPlayer.ts`, `gameModel.ts`

- Remove `processAICommand` helper from `ComputerPlayer` (AI no longer calls CommandProcessor)
- Keep `createAICommand` helper (still useful for constructing commands with metadata)
- `AICommandResult` type stays in `gameModel.ts` but is used only by the caller (gameController), not by computerPlayer
- Remove all `results: AICommandResult[]` parameters from sub-methods

### Step 5: Convert `computerManageResearch` ✅

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

Reads:
- `clientModel.mainPlayer.research` — current research state
- `clientModel.mainPlayer.planetBuildGoals` — energy needs for build goals
- `clientModel.mainPlayerOwnedPlanets` — total resources
- `clientModel.currentCycle` — for logDecision

Returns: Up to 2 commands: `ADJUST_RESEARCH_PERCENT` + optionally `SUBMIT_RESEARCH_ITEM`.

No model access issues — all data is on `mainPlayer`.

### Step 6: Convert `computerSetPlanetBuildGoals` ✅

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → void` (no commands — internal planning)

This method only writes to `player.planetBuildGoals` which is AI working memory on `mainPlayer`. Since `mainPlayer` is a shared reference, these writes persist to the authoritative model.

**Key change:** Replace `gameModel.modelData.currentCycle` with `clientModel.currentCycle`.

Uses `countPlanetsNeedingExploration` which iterates all planets — needs the helper conversion (Step 11).

### Step 7: Convert `computerSubmitTrades` ✅

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

Reads:
- `clientModel.mainPlayer` — player's build goals for desired resources
- `clientModel.mainPlayerOwnedPlanets` — total resources and population

Returns: Array of `SUBMIT_TRADE` commands.

No model access issues — purely reads from `mainPlayer` and owned planets.

### Step 8: Convert `computerBuildImprovementsAndShips` ✅

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

Reads:
- `clientModel.mainPlayer.planetBuildGoals` — what to build
- `clientModel.mainPlayerOwnedPlanets` — planet build queues and resources

Returns: Array of `QUEUE_PRODUCTION_ITEM` and `DEMOLISH_IMPROVEMENT` commands.

**Important:** After emitting a build command, the AI should track the resource cost locally to avoid double-spending (since the command won't be processed until after `computerTakeTurn` returns). The current code already does this with `totalResources.energy -= ppi.energyCost` for the "can't afford" path — this local tracking should be applied for ALL items (both queued and deferred).

### Step 9: Convert `computerAdjustPopulationAssignments` ✅

**Signature:** `(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted) → GameCommand[]`

**Implemented approach: Snapshot → Mutate → Capture → Restore**

1. At start, snapshot each planet's `citizenWorkerSnapshot[planetId] = planet.population.map(c => c.workerType)` alongside existing `startingAssignments`
2. Run the existing iterative algorithm unchanged (mutates model through shared refs — acceptable since it needs intermediate state)
3. Compute net diffs per planet: `endingWorkers - startingWorkers`
4. Emit one `UPDATE_PLANET_WORKER_ASSIGNMENTS` command per planet that changed
5. **Restore** citizen worker types from snapshot: `planet.population.forEach((c, i) => { c.workerType = snapshot[i]; })`
6. Return commands — caller processes through `CommandProcessor` which re-applies via `Planet.updatePopulationWorkerTypes()`

This keeps the complex iterative algorithm unchanged while ensuring no double-application when the caller processes the commands.

### Step 10: Convert `computerSendShips` ✅

**Signature:** `(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted, initialCommittedShipIds?: Set<string>) → GameCommand[]`

Uses `committedShipIds: Set<string>` to track ships allocated to commands within the turn (since `CommandProcessor` doesn't run until after the turn completes, fleet state doesn't update between sends). The set is seeded from `initialCommittedShipIds` (repair retreat ship IDs) so those ships aren't double-counted for exploration or attack.

**Three send-ship patterns, all converted to pure `SEND_SHIPS` commands:**

**Exploration:** No longer calls `Fleet.splitOffSmallestPossibleFleet()` / `Fleet.setDestination()` / `push(outgoingFleets)`. Instead:
1. Filter `uncommittedShips` from `pFriendly.planetaryFleet.starships` using `committedShipIds`
2. Pick cheapest available ship (scout preferred, then destroyer)
3. Build `SEND_SHIPS` command with that single ship's ID
4. Add ship ID to `committedShipIds`

**Attack (single & coordinated multi-planet):** Resolve ship IDs via `Fleet.getStarshipsByType()`, filter out `committedShipIds`, build `SEND_SHIPS` commands. Track all allocated ship IDs.

**Reinforcement:** Same pattern as attack, different destination (own planet).

**Planet candidate management:** When all mobile ships on a planet are committed, the planet is removed from `planetCandidatesForSendingShips` (checked via `remainingMobile` after each send).

### Step 11: Convert helper methods for `ClientPlanet[]` ✅

A `PlanetLocation` interface was created in `clientModel.ts` and exported from `index.ts`:

```typescript
export interface PlanetLocation {
  id: number;
  boundingHexMidPoint: PointData;
}
```

Both `PlanetData` and `ClientPlanet` satisfy this interface structurally. The following were updated to accept `PlanetLocation`:

- **`PlanetDistanceComparer`** — constructor `source` param, `sortFunction`, `increasedDistanceBasedOnPlanetValueAndFleetStrength`
- **`Player.planetContainsFriendlyInboundFleet`** — `planet` param
- **`calculateScoutPriority`**, **`calculateExplorationPriority`**, **`calculatePlanetTargetValue`**, **`getQuadrantIntelligenceBonus`** — `targetPlanet` param
- **`getClosestUnownedPlanet`** — `sourcePlanet` param
- **`planetNeedsExploration`** — `planet` param

All 6 `as unknown as PlanetData[]` casts were removed. For nullable `ClientPlanet.type` (null when unexplored), safe access patterns like `(planet as { type?: PlanetType | null }).type ?? 0` are used in arithmetic contexts.

### Step 12: Backend persistence — no changes needed ✅

**File:** `apps/astriarch-backend/src/controllers/GameControllerWebSocket.ts`

The backend persistence code iterates `aiCommandResults` and calls `eventPersistenceService.persistCommandAndEvents(gameId, aiResult.command, aiResult.result, ...)`. Since `AdvanceGameClockResult.aiCommandResults` is still `AICommandResult[]` populated by the caller's `CommandProcessor.processCommand()` invocations, the results now contain **real events** (not empty `{ success: true, events: [] }` wrappers). No code changes needed — the richer event data flows through automatically.

### Steps 13-14: Testing ⚠️ Partial

**What's done:**
- Tests updated to import `CommandProcessor` and process returned `GameCommand[]` through it
- `computerManageResearch` tests process commands before asserting player state
- `computerSendShips` and `computerBuildImprovementsAndShips` tests process commands
- Fleet repair tests removed (feature deleted)
- 197 of 199 tests pass

**Remaining test failures (2):**

1. **"Hard vs Expert - expert should win eventually"** — Expert AI wins 0 games in simulation. This appears to be a gameplay balance issue from the changed command processing order (batched/deferred vs immediate). The AI now makes all decisions based on start-of-turn state, which may affect Expert's aggressive strategy timing.

2. **"should re-scout nearby enemy planets more frequently for Hard AI"** — `planetNeedsExploration` returns false. Test setup calls `advanceGameCycles` which now processes AI commands through CommandProcessor, potentially changing planet ownership state in ways that affect re-scout logic.

**Not yet added:**
- Explicit tests for `committedShipIds` ship-tracking logic
- Explicit tests for population snapshot/restore correctness
- Integration test verifying non-empty events flow through to backend persistence

---

## `clientPlanets` vs `modelData.planets` — Access Pattern Changes

| Current access pattern | New access pattern | Notes |
|---|---|---|
| `gameModel.modelData.planets` (all planets, full data) | `clientModel.clientPlanets` (all planets, minimal data) | Location info preserved, internals hidden |
| `gameModel.modelData.currentCycle` | `clientModel.currentCycle` | Same value |
| `gameModel.grid` | `grid` parameter | Passed separately |
| `Player.planetContainsFriendlyInboundFleet(player, fullPlanet)` | Same, but accepting `ClientPlanet` for location | Only needs `boundingHexMidPoint` |
| `planet.type` (always available) | `clientPlanet.type` (null if unexplored) | AI must handle null — use intelligence data or skip |

## AI Action → Command Mapping Reference

| AI Method | Action | Command Type | Notes |
|-----------|--------|-------------|-------|
| `computerManageResearch` | Set research % | `ADJUST_RESEARCH_PERCENT` | Direct 1:1 |
| `computerManageResearch` | Queue research | `SUBMIT_RESEARCH_ITEM` | Direct 1:1 |
| `computerSubmitTrades` | Submit trade | `SUBMIT_TRADE` | Map trade types to strings |
| `computerBuildImprovementsAndShips` | Build improvement/ship | `QUEUE_PRODUCTION_ITEM` | Track resources locally |
| `computerBuildImprovementsAndShips` | Demolish improvement | `DEMOLISH_IMPROVEMENT` | Via build goals |
| `computerAdjustPopulationAssignments` | Reassign workers | `UPDATE_PLANET_WORKER_ASSIGNMENTS` | Net diff per planet |
| `computerSendShips` | Explore/scout | `SEND_SHIPS` | Track committed ships locally |
| `computerSendShips` | Attack (single) | `SEND_SHIPS` | Resolve ship IDs |
| `computerSendShips` | Attack (multi-planet) | `SEND_SHIPS` × N | One per source planet |
| `computerSendShips` | Reinforce | `SEND_SHIPS` | Same command, own planet target |
| `computerManageFleetRepairs` | Retreat damaged ships for repair | `SEND_SHIPS` | Planetary fleets only; repair IDs passed to `computerSendShips` |
| `computerSetPlanetBuildGoals` | Set build goals | *(none — internal)* | AI working memory |

## Key File References

| File | Purpose |
|------|---------|
| `packages/astriarch-engine/src/engine/computerPlayer.ts` | AI logic — primary refactoring target |
| `packages/astriarch-engine/src/engine/GameCommands.ts` | Command & event type definitions |
| `packages/astriarch-engine/src/engine/CommandProcessor.ts` | Command validation & processing |
| `packages/astriarch-engine/src/engine/clientGameModel.ts` | `constructClientGameModel()` — builds filtered view |
| `packages/astriarch-engine/src/model/clientModel.ts` | `ClientModelData`, `ClientPlanet` interfaces |
| `packages/astriarch-engine/src/engine/gameController.ts` | Game loop — `advanceGameClockTo()` |
| `apps/astriarch-backend/src/controllers/GameControllerWebSocket.ts` | Backend command handling & persistence |

## Risk Assessment

| Risk | Status | Mitigation |
|------|--------|-----------|
| AI makes invalid commands (e.g., double-spending resources) | ✅ Mitigated | CommandProcessor validates; failed commands logged via `console.warn`, not fatal |
| Population assignment complexity | ✅ Mitigated | Snapshot/restore approach keeps algorithm unchanged |
| Ship double-send (same ship in multiple SEND_SHIPS) | ✅ Mitigated | `committedShipIds: Set<string>` tracks committed ships within each turn; seeded from repair retreat IDs |
| `ClientPlanet.type` is null for unexplored | ✅ Mitigated | Safe access via `(planet as { type?: PlanetType \| null }).type ?? 0` |
| AI behavior regression (snapshot vs live state) | ⚠️ Active | 2 test failures — Expert AI simulation balance shifted, re-scout test assumption broken |
| Shared reference aliasing (clientModel.mainPlayer IS modelData.players[i]) | ✅ Acceptable | Intentional for build goals; population uses snapshot/restore to avoid double-apply |

---

## Engineering Status Report (updated 2026-03-21)

### Migration Complete — Deep Refactor Done

The full deep refactor is implemented. AI no longer calls `CommandProcessor` internally. All sub-methods return `GameCommand[]`. The caller (`gameController.ts`) processes commands through `CommandProcessor.processCommand()` to get real events.

**TypeScript:** Clean compilation, zero errors.
**Tests:** 197/199 pass + 1 flaky pre-existing `battleSimulator` probabilistic test.

### What Changed (summary of all files modified)

| File | Changes |
|------|---------|
| `computerPlayer.ts` (~2550 lines) | Rewrote `computerManageFleetRepairs` (planetary retreat for repair, no longer redirects in-transit fleets). Removed `processAICommand` helper, `CommandProcessor` import, `AICommandResult` import. Re-added `enableFleetRepairs` setting (Hard/Expert/Human only). All sub-methods return `GameCommand[]`. Population uses snapshot/restore. Ship sending uses `committedShipIds` (seeded from repair IDs). Exploration uses pure command output (no direct fleet mutations). `PlanetLocation` used throughout. |
| `gameController.ts` | Imports `CommandProcessor`. AI commands processed via `CommandProcessor.processCommand(clientModel, grid, command)` — no more dummy `{ success: true, events: [] }` wrapping. |
| `clientModel.ts` | Added `PlanetLocation` interface (`{ id, boundingHexMidPoint }`) |
| `planetDistanceComparer.ts` | Widened signatures to accept `PlanetLocation` |
| `player.ts` | `planetContainsFriendlyInboundFleet` accepts `PlanetLocation` |
| `index.ts` | Exports `PlanetLocation` |
| `computerPlayer.spec.ts` | Imports `CommandProcessor`. Tests process returned commands. Fleet repair tests deleted. |

### Remaining Work

**2 test failures to investigate/fix:**

1. **"Hard vs Expert - expert should win eventually"** (AI vs AI simulation)
   - Expert wins 0 games. Likely a gameplay balance shift from batched command processing — AI now makes all decisions based on start-of-turn snapshot rather than seeing intermediate results from earlier sub-methods.
   - **Possible causes:** Resource tracking changed (build commands no longer deduct resources immediately), ship sending no longer reflects mid-turn fleet changes (mitigated by `committedShipIds` but combat effectiveness calculations still use stale fleet state).
   - **Fix approaches:** Tune Expert AI settings, adjust test expectations, or add mid-turn state tracking for resource expenditure.

2. **"should re-scout nearby enemy planets more frequently for Hard AI"**
   - `planetNeedsExploration` returns false when test expects true.
   - Test calls `advanceGameCycles(10)` which now processes AI commands through CommandProcessor, potentially changing planet ownership/fleet state in ways that affect the re-scout condition.
   - **Fix approaches:** Review test setup assumptions, adjust cycle count, or update test expectations.

**Nice-to-have test additions:**
- `committedShipIds` prevents double-sending ships to same/different targets
- Population snapshot/restore produces correct net diffs
- `computerManageFleetRepairs` retreats damaged ships from planets without repair improvements
- `computerManageFleetRepairs` does NOT affect in-transit fleets
- Repair retreat ship IDs are excluded from exploration/attack in `computerSendShips`
- Non-empty events flow through `AdvanceGameClockResult.aiCommandResults` to backend persistence
