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
| **Remove** | 3 | Delete `computerManageFleetRepairs` entirely | Not started |
| **Remove** | 4 | Remove `processAICommand` helper — AI returns commands, caller processes | Not started |
| **Convert** | 5 | Stop AI from calling `CommandProcessor` internally; return `GameCommand[]` from each sub-method | Not started |
| **Convert** | 6 | Remove `clientPlanets as unknown as PlanetData[]` casts — use `ClientPlanet` natively (6 locations) | Not started |
| **Convert** | 7 | Convert `computerAdjustPopulationAssignments` — snapshot/restore pattern for net diff commands | Not started |
| **Convert** | 8 | Convert `computerSendShips` — local committed-ship tracking, return `SEND_SHIPS` commands | Not started |
| **Caller** | 9 | `gameController.ts`: process returned commands through `CommandProcessor.processCommand(modelData, grid, cmd)` | Not started |
| **Backend** | 10 | Update backend `GameControllerWebSocket.ts` persistence if needed | Not started |
| **Test** | 11 | Update and add tests for command-only AI flow | Not started |
| **Test** | 12 | Full game simulation: verify AI behavior is unchanged | Not started |

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

### 3. `computerManageFleetRepairs` is deleted

This feature was never intended behavior. It:
- Redirects in-transit fleets by calling `Fleet.setDestination()` directly
- Would require a `REDIRECT_FLEET` command type that doesn't exist
- Gives AI an unfair advantage (human players can't redirect in-transit fleets)

Rather than defer it, we remove it entirely + remove the `enableFleetRepairs` AI setting.

### 4. Population assignments: full command pipeline (no hybrid)

v1 used a "hybrid" approach where population was iteratively mutated directly, then net diffs were recorded as pre-applied commands. In v2, the AI emits `UPDATE_PLANET_WORKER_ASSIGNMENTS` commands for each incremental change. Since commands are processed by the caller after the AI's turn, the iterative algorithm needs to track its own internal state (farmer/miner/builder counts) without mutating the model.

The AI will maintain local working copies of population counts and resource production rates, compute the desired changes, then emit the **net diff per planet** as commands — same as v1's output, but computed purely from local state without any model mutation.

### 5. `clientPlanets` replaces `modelData.planets` for planet iteration

Everywhere the AI currently iterates `gameModel.modelData.planets` (the full planet list), it will instead iterate `clientModel.clientPlanets`. The `ClientPlanet` type has `{ id, name, originPoint, boundingHexMidPoint, type: PlanetType | null }` — sufficient for:
- Distance calculations (via `boundingHexMidPoint`)
- Exploration checks (`type === null` means unexplored)
- Target identification by location

For **owned planets**, the AI uses `mainPlayerOwnedPlanets` which has full `PlanetData`.

### 6. Build goals stay as direct player state mutation

`player.planetBuildGoals` is AI-internal planning state on `mainPlayer`. Since `mainPlayer` in `ClientModelData` is a **shared reference** to the same `PlayerData` object in `ModelData`, writing to `player.planetBuildGoals` is acceptable — it's not a game action, it's AI working memory. Human players also have this field but set it through UI interactions that don't generate commands.

## Architecture

### Before (v1 — current)
```
advanceGameClockTo()
  └─ FOR EACH AI PLAYER:
       aiResults = ComputerPlayer.computerTakeTurn(gameModel, player, ownedPlanets)
         ├─ computerManageResearch()         → calls CommandProcessor internally
         ├─ computerSetPlanetBuildGoals()    → mutates player.planetBuildGoals
         ├─ computerSubmitTrades()           → calls CommandProcessor internally
         ├─ computerBuildImprovementsAndShips() → calls CommandProcessor internally
         ├─ computerAdjustPopulationAssignments() → HYBRID: direct mutation + net diff commands
         ├─ computerManageFleetRepairs()     → direct Fleet.setDestination() mutation
         └─ computerSendShips()             → HYBRID: some CommandProcessor, some direct mutation
       allAICommandResults.push(...aiResults)
```
AI operates on full `GameModelData`, calls `CommandProcessor.processCommand(modelData, grid, cmd)` internally, receives `AICommandResult[]` back.

### After (v2 — target)
```
advanceGameClockTo()
  └─ FOR EACH AI PLAYER:
       clientModel = ClientGameModel.constructClientGameModel(modelData, player.id)
       commands = ComputerPlayer.computerTakeTurn(clientModel, grid)
         ├─ computerManageResearch()         → returns GameCommand[]
         ├─ computerSetPlanetBuildGoals()    → mutates clientModel.mainPlayer.planetBuildGoals (AI working memory)
         ├─ computerSubmitTrades()           → returns GameCommand[]
         ├─ computerBuildImprovementsAndShips() → returns GameCommand[]
         ├─ computerAdjustPopulationAssignments() → returns GameCommand[] (pure computation, no model mutation)
         └─ computerSendShips()             → returns GameCommand[]
       FOR EACH command:
         result = CommandProcessor.processCommand(modelData, grid, command)
         allAICommands.push({ command, result })
```
AI operates on `ClientModelData` only. Returns `GameCommand[]`. Caller processes on `ModelData`.

---

## Step Details

### Step 1: New `computerTakeTurn` signature

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

### Step 2: Update `gameController.ts` caller

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

### Step 3: Delete `computerManageFleetRepairs`

**File:** `packages/astriarch-engine/src/engine/computerPlayer.ts`

Remove the entire method and its call in `computerTakeTurn`. Also remove `enableFleetRepairs` from `AISettings` interface and all per-difficulty settings objects.

This feature was unintended and gives AI an unfair advantage. Human players cannot redirect in-transit fleets.

### Step 4: Remove `AICommandResult` from computerPlayer, clean up helpers

**Files:** `packages/astriarch-engine/src/engine/computerPlayer.ts`, `gameModel.ts`

- Remove `processAICommand` helper from `ComputerPlayer` (AI no longer calls CommandProcessor)
- Keep `createAICommand` helper (still useful for constructing commands with metadata)
- `AICommandResult` type stays in `gameModel.ts` but is used only by the caller (gameController), not by computerPlayer
- Remove all `results: AICommandResult[]` parameters from sub-methods

### Step 5: Convert `computerManageResearch`

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

Reads:
- `clientModel.mainPlayer.research` — current research state
- `clientModel.mainPlayer.planetBuildGoals` — energy needs for build goals
- `clientModel.mainPlayerOwnedPlanets` — total resources
- `clientModel.currentCycle` — for logDecision

Returns: Up to 2 commands: `ADJUST_RESEARCH_PERCENT` + optionally `SUBMIT_RESEARCH_ITEM`.

No model access issues — all data is on `mainPlayer`.

### Step 6: Convert `computerSetPlanetBuildGoals`

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → void` (no commands — internal planning)

This method only writes to `player.planetBuildGoals` which is AI working memory on `mainPlayer`. Since `mainPlayer` is a shared reference, these writes persist to the authoritative model.

**Key change:** Replace `gameModel.modelData.currentCycle` with `clientModel.currentCycle`.

Uses `countPlanetsNeedingExploration` which iterates all planets — needs the helper conversion (Step 11).

### Step 7: Convert `computerSubmitTrades`

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

Reads:
- `clientModel.mainPlayer` — player's build goals for desired resources
- `clientModel.mainPlayerOwnedPlanets` — total resources and population

Returns: Array of `SUBMIT_TRADE` commands.

No model access issues — purely reads from `mainPlayer` and owned planets.

### Step 8: Convert `computerBuildImprovementsAndShips`

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

Reads:
- `clientModel.mainPlayer.planetBuildGoals` — what to build
- `clientModel.mainPlayerOwnedPlanets` — planet build queues and resources

Returns: Array of `QUEUE_PRODUCTION_ITEM` and `DEMOLISH_IMPROVEMENT` commands.

**Important:** After emitting a build command, the AI should track the resource cost locally to avoid double-spending (since the command won't be processed until after `computerTakeTurn` returns). The current code already does this with `totalResources.energy -= ppi.energyCost` for the "can't afford" path — this local tracking should be applied for ALL items (both queued and deferred).

### Step 9: Convert `computerAdjustPopulationAssignments`

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

**This is the most complex conversion.** The current algorithm does dozens of incremental `Planet.updatePopulationWorkerTypesByDiff(planet, player, ±1, ±1, ±1)` calls across 4 phases.

**Approach: Pure computation with local tracking**

1. At the start, snapshot each planet's current worker counts into a local `Map<planetId, {farmers, miners, builders}>`
2. Run the existing algorithm but instead of calling `Planet.updatePopulationWorkerTypesByDiff`, update the local counts and locally compute resource generation changes
3. At the end, compute net diffs per planet: `endingWorkers - startingWorkers`
4. Emit one `UPDATE_PLANET_WORKER_ASSIGNMENTS` command per planet that changed

The `planetResourcesPerTurn` calculation still needs `Planet.getPlanetWorkerResourceGeneration()` for initial values. As the algorithm proceeds, instead of calling `Planet.updatePopulationWorkerTypesByDiff()` (which mutates the planet), maintain local resource generation estimates.

**Alternative simpler approach:** Keep the current iterative mutation code (since `mainPlayer` and owned planets are shared references), but record the initial worker counts, let the mutations happen, then capture the net diff per planet as commands at the end. This is functionally identical to v1's hybrid approach but is correct because:
- The mutations happen to shared objects (same as authoritative model)
- The commands capture the net result for persistence/replay
- Since the caller also processes commands on `modelData`, we need to ensure no double-application

**Decision: Use the "snapshot → mutate → capture → restore" approach.** The AI freely mutates model state through shared refs during the iterative algorithm (this is acceptable). Then:
1. Snapshot initial worker counts at start
2. Run iterative algorithm (mutates model through shared refs)
3. Compute net diffs per planet
4. **Restore** worker counts to initial snapshot
5. Return `UPDATE_PLANET_WORKER_ASSIGNMENTS` commands with net diffs
6. Caller processes commands through CommandProcessor → applies mutations through events → persists

This keeps the complex algorithm unchanged while ensuring all game-state mutations go through the event pipeline for persistence, matching how the server handles human players.

### Step 10: Convert `computerSendShips`

**Signature change:** `(clientModel: ClientModelData, grid: Grid) → GameCommand[]`

Three send-ship patterns, all converted to `SEND_SHIPS` commands:

**Exploration:** Currently calls `Fleet.splitOffSmallestPossibleFleet()` then `Fleet.setDestination()`. Instead:
1. Read `planet.planetaryFleet.starships` to find the cheapest ship (scout preferred)
2. Build a `SEND_SHIPS` command with that single ship's ID
3. Track locally that this ship is "committed" so we don't send it again

**Attack (single & multi-planet):** Currently reads fleet composition, decides if strength is sufficient, then splits and sends. Instead:
1. Read fleet composition from `mainPlayerOwnedPlanets[planetId].planetaryFleet`
2. Use `Fleet.getStarshipsByType()` to get ship IDs by type
3. Build `SEND_SHIPS` command with the selected ship IDs
4. Track locally that these ships are committed

**Reinforcement:** Same pattern as attack, different destination (own planet instead of enemy).

**Local tracking challenge:** Since commands aren't processed until after `computerTakeTurn` returns, the AI's view of planet fleets doesn't update between sends. The AI needs to locally track which ships have been "committed" to avoid double-sending. Use a `Set<string>` of committed ship IDs that's checked before each send.

**Fleet ID:** Use `clientModel.mainPlayer.nextFleetId++` to generate fleet IDs (same as human player).

### Step 11: Convert helper methods for `ClientPlanet[]`

Several helpers iterate `gameModel.modelData.planets` (full `PlanetData[]`). These need to accept `ClientPlanet[]` or `ClientModelData` instead:

**`countPlanetsNeedingExploration`:**
- Currently: iterates `gameModel.modelData.planets`
- After: iterates `clientModel.clientPlanets`
- Works because it only uses `planet.id` and `planet.boundingHexMidPoint` (both on `ClientPlanet`)
- For `planetContainsFriendlyInboundFleet`: the method needs `planet.boundingHexMidPoint` — available on `ClientPlanet`
- BUT the `PlanetData` type is expected, not `ClientPlanet`. Need to update `planetContainsFriendlyInboundFleet` to accept `{ boundingHexMidPoint }` or create a minimal interface

**`planetNeedsExploration`:**
- Currently: receives `PlanetData`, iterates `gameModel.modelData.planets`
- After: receives `ClientPlanet`, iterates `clientModel.clientPlanets`
- For unexplored planets: `planet.type === null` (in ClientPlanet) means unexplored
- For re-scouting: checks `player.lastKnownPlanetFleetStrength[planet.id]` which is on mainPlayer

**`calculateScoutPriority` / `calculateExplorationPriority`:**
- Uses `planet.type` and `planet.boundingHexMidPoint` — both available on `ClientPlanet` (type may be null for unexplored, need to handle)

**`getClosestUnownedPlanet`:**
- Currently: iterates `gameModel.modelData.planets`, returns `PlanetData`
- After: iterates `clientModel.clientPlanets`, returns `ClientPlanet`
- Only uses `boundingHexMidPoint` for distance calculations — works with `ClientPlanet`

**`calculatePlanetTargetValue`:**
- Uses `targetPlanet.type` — available on `ClientPlanet` if explored (null otherwise)
- Uses `player.lastKnownPlanetFleetStrength[planet.id]` — available on mainPlayer
- Uses `boundingHexMidPoint` — available on `ClientPlanet`
- Needs to handle `type === null` (unknown planet) — could assign a default value or skip

**`PlanetDistanceComparer`:**
- Uses `boundingHexMidPoint` — available on `ClientPlanet`
- May need type updates to accept `ClientPlanet | PlanetData`

**Common interface:** Consider creating a shared `PlanetLocation` interface:
```typescript
interface PlanetLocation {
  id: number;
  boundingHexMidPoint: PointData;
}
```
This can be used by distance-calculating helpers, and both `PlanetData` and `ClientPlanet` satisfy it naturally.

### Step 12: Update backend persistence

**File:** `apps/astriarch-backend/src/controllers/GameControllerWebSocket.ts`

The current v1 code already captures `aiCommandResults` and persists them. The only change is that `aiCommandResults` in `AdvanceGameClockResult` now contains results from the **caller's** CommandProcessor invocations rather than from the AI's internal processing. The persistence code doesn't need to change — it already iterates and persists each `{ command, result }` pair.

### Steps 13-14: Testing

**Engine tests:**
- Update test setup to construct `ClientModelData` instead of passing `GameModelData`
- Verify returned `GameCommand[]` are well-formed
- Process returned commands through `CommandProcessor` and verify state matches expectations

**AI behavior regression:**
- Run AI-vs-AI simulations
- Compare game outcomes (planets captured, research levels, etc.)
- Look for any AI behavior degradation due to snapshot-based decision making

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
| `computerSetPlanetBuildGoals` | Set build goals | *(none — internal)* | AI working memory |
| ~~`computerManageFleetRepairs`~~ | ~~Redirect fleet~~ | **DELETED** | Unintended feature removed |

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

| Risk | Mitigation |
|------|-----------|
| AI makes invalid commands (e.g., double-spending resources) | CommandProcessor validates; failed commands logged, not fatal |
| Population assignment complexity | Use pure computation approach; extensive testing |
| Ship double-send (same ship in multiple SEND_SHIPS) | Local `committedShipIds` set tracking |
| `ClientPlanet.type` is null for unexplored | Handle in priority calculations; use intelligence data instead |
| AI behavior regression (snapshot vs live state) | AI-vs-AI simulation comparison tests |
| Shared reference aliasing (clientModel.mainPlayer IS modelData.players[i]) | This is intentional — build goals need to persist; population approach avoids relying on this |

---

## Engineering Handoff Report (2026-03-07)

### What Was Completed — Spike Refactor

The "interface spike" is complete. All signatures have been changed, everything builds and tests pass (200/201, 1 pre-existing failure).

**Files changed:**
- `packages/astriarch-engine/src/engine/computerPlayer.ts` — All method signatures changed from `gameModel: GameModelData` to `clientModel: ClientModelData, grid: Grid`
- `packages/astriarch-engine/src/engine/gameController.ts` — Caller now constructs `ClientModelData` via `ClientGameModel.constructClientGameModel(modelData, p.id)`
- `packages/astriarch-engine/src/engine/computerPlayer.spec.ts` — All test call sites updated to construct `clientModel` before calling

**How it works right now (post-spike, pre-deep-refactor):**
1. `gameController.ts` constructs `ClientModelData` for each AI player
2. `computerTakeTurn(clientModel, grid)` receives it
3. Internally, sub-methods still call `processAICommand(clientModel, grid, cmd, results)` which calls `CommandProcessor.processCommand(clientModel, grid, cmd)`
4. Because `clientModel.mainPlayer` and `clientModel.mainPlayerOwnedPlanets` are **shared references** (NOT deep copies) to objects in `modelData`, CommandProcessor mutations **flow through** to the authoritative model
5. `computerTakeTurn` returns `GameCommand[]` (extracted from `AICommandResult[]`)
6. The caller wraps each command with a dummy `{ success: true, events: [] }` result for persistence

This is a **functioning but intermediate state** — the AI is technically mutating the server model through the shared references. The deep refactor will change AI to just return commands without calling CommandProcessor.

### Key Design Decision: Shared References Are OK for Mutations

The owner confirmed: it's OK for AI to mutate `mainPlayer` state during computation. The requirement is that **the server must only persist mutations done through event application** — the same as human players. So the deep refactor goal is:
- AI returns `GameCommand[]` only
- Caller processes commands through `CommandProcessor.processCommand(modelData, grid, cmd)` → events
- Events are persisted as the official record
- Any internal AI mutations (e.g., population assignment iteration) must be snapshot/restored

### Technical Debt from the Spike

**1. `clientModel.clientPlanets as unknown as PlanetData[]` — 6 unsafe casts**

Locations (line numbers approximate):
- `computerSendShips` lines 1314, 1328 — iterating all planets for target selection
- `countPlanetsNeedingExploration` line 1873
- `planetNeedsExploration` line 1909
- `calculateScoutPriority` line 2003
- `getClosestUnownedPlanet` line 2120

These iterate `clientPlanets` (typed as `ClientPlanet[]`) but the code expects `PlanetData` for calls to `Player.planetContainsFriendlyInboundFleet(player, p)` and `PlanetDistanceComparer`. Both only use `boundingHexMidPoint` which exists on `ClientPlanet`, so the cast is safe *at runtime* but not type-safe.

**Fix approach:** Create a shared `PlanetLocation` interface `{ id: number; boundingHexMidPoint: PointData }` that both `PlanetData` and `ClientPlanet` satisfy. Update `PlanetDistanceComparer.sortFunction`, `Player.planetContainsFriendlyInboundFleet`, and the helper methods to accept `PlanetLocation` instead of `PlanetData`. This eliminates all 6 casts.

**2. `processAICommand` still exists and calls CommandProcessor internally**

Currently 8 call sites inside computerPlayer.ts:
- `computerSubmitTrades` (1)
- `computerBuildImprovementsAndShips` (2 — build + demolish)
- `computerSendShips` (3 — exploration, single attack, reinforcement)
- `computerManageResearch` (2 — adjust percent + submit item)

Deep refactor: replace each `processAICommand(clientModel, grid, cmd, results)` call with `commands.push(cmd)` and change each sub-method to return `GameCommand[]` instead of `AICommandResult[]`.

**3. `computerAdjustPopulationAssignments` — hybrid mutation + net-diff commands**

Currently: iteratively mutates planet population using `Planet.updatePopulationWorkerTypesByDiff()`, then computes net diffs from start/end snapshots and creates pre-applied commands (lines 740-776).

Deep refactor approach (snapshot/restore):
1. Snapshot initial worker counts per planet
2. Let the iterative algorithm run (it mutates through shared refs — that's fine)
3. Capture net diffs per planet
4. **Restore** worker counts to initial snapshot values
5. Return `UPDATE_PLANET_WORKER_ASSIGNMENTS` commands with net diffs
6. Caller processes commands through CommandProcessor → applies via events

This keeps the complex algorithm unchanged while ensuring mutations go through the event pipeline.

**4. `gameController.ts` caller wraps commands with dummy results**

Lines 84-91 currently wrap each AI command with `{ success: true, events: [] }`. The deep refactor will replace this with actual `CommandProcessor.processCommand(modelData, grid, command)` calls.

**5. `computerManageFleetRepairs` — slated for deletion**

Still present, still directly mutates `Fleet.setDestination()` on in-transit fleets. This is an unintended feature that gives AI an unfair advantage. Should be deleted entirely along with the `enableFleetRepairs` AI setting.

### Recommended Implementation Order for Deep Refactor

1. **Delete `computerManageFleetRepairs`** and `enableFleetRepairs` setting — simplest change, removes complexity
2. **Create `PlanetLocation` interface** and widen types on `PlanetDistanceComparer`, `Player.planetContainsFriendlyInboundFleet`, and helper methods — eliminates all 6 unsafe casts
3. **Convert sub-methods to return `GameCommand[]`** — replace `processAICommand()` calls with `commands.push()`, remove `results` accumulators. Start with simpler methods (research, trades, build) then harder ones (send ships, population).
4. **Update `computerAdjustPopulationAssignments`** with snapshot/restore pattern
5. **Update `gameController.ts` caller** to process returned commands through CommandProcessor on `modelData`
6. **Remove `processAICommand` helper** — no longer needed
7. **Run full test suite + AI-vs-AI simulations** to verify behavioral equivalence

### Test Status

- **200 / 201 engine tests pass** (1 pre-existing failure: "should re-scout nearby enemy planets more frequently for Hard AI" — this test has been failing since before this work)
- **Backend builds clean** against the new engine interface
- **Frontend not tested** but has no direct dependency on computerPlayer signatures

### Files to Know

| File | Lines | What to know |
|------|-------|--------------|
| `computerPlayer.ts` | ~2500 | All signatures updated. 8 `processAICommand` calls to convert. 6 `as unknown as PlanetData[]` casts to fix. |
| `gameController.ts` | ~716 | Lines 80-91: AI caller with TODO comment. Currently wraps commands with dummy results. |
| `computerPlayer.spec.ts` | ~1198 | All call sites updated. Fleet repair tests will need deletion when that feature is removed. |
| `clientGameModel.ts` | ~97 | `constructClientGameModel()` creates shared refs for mainPlayer/ownedPlanets, new objects for clientPlanets/clientPlayers. |
| `clientModel.ts` | ~80 | `ClientPlanet = { id, name, originPoint, boundingHexMidPoint, type: PlanetType \| null }` |
| `CommandProcessor.ts` | ~1041 | Already handles both `ModelData` and `ClientModelData`. `processCommand()` is the entry point. |
| `planetDistanceComparer.ts` | ~109 | `sortFunction(a: PlanetData, b: PlanetData)` — needs widening to accept `PlanetLocation`. |
