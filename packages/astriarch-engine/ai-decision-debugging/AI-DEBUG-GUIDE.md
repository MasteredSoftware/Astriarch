# AI Decision Logging - Debug Guide

## Overview

The AI decision logging system captures detailed information about every decision the AI makes during gameplay. This makes it easy to understand, debug, and visualize AI behavior during tests.

## Quick Start

### 1. Enable Debug Mode in Your Test

```typescript
import { enableAIDebug, disableAIDebug } from './testUtils';

beforeEach(() => {
  enableAIDebug(); // Turns on logging
});

afterEach(() => {
  disableAIDebug(); // Cleans up
});
```

### 2. Run Your Game/Test

```typescript
const { gameModel } = startNewTestGame();

// Play through some turns
for (let turn = 0; turn < 10; turn++) {
  GameModel.nextTurn(gameModel);
}
```

### 3. Analyze the Results

```typescript
import { getAIDecisionSummary, printAIDecisions } from './testUtils';

// Get summary statistics
const summary = getAIDecisionSummary();
console.log('Total decisions:', summary.total);
console.log('By category:', summary.byCategory);
console.log('By player:', summary.byPlayer);

// Print all decisions
printAIDecisions();

// Or filter by category
printAIDecisions('research');
printAIDecisions('combat');
printAIDecisions('building');

// Or filter by player
printAIDecisions(undefined, 'Computer1');
```

## Decision Categories

The AI logs decisions in these categories:

- **research** - Research percentage adjustments and tech choices
- **building** - Build goals for improvements and ships
- **combat** - Attack decisions and fleet movements
- **exploration** - Scout fleet dispatches to unexplored planets
- **population** - Worker assignments and food management
- **economy** - Resource trading and allocation

## Decision Log Structure

Each decision contains:

```typescript
{
  turn: number;              // Game turn when decision was made
  playerId: string;          // AI player ID
  playerName: string;        // AI player name
  decision: string;          // Human-readable description
  category: string;          // Category (see above)
  details: Record<string, any>; // Specific data about the decision
  timestamp: number;         // Unix timestamp
}
```

## Common Use Cases

### Debug Energy Shortages

```typescript
const summary = getAIDecisionSummary();

// Look at research decisions
const researchDecisions = summary.decisions.filter(d => d.category === 'research');
researchDecisions.forEach(d => {
  console.log(`Turn ${d.turn}: Research ${d.details.adjustedPercent}%`);
  console.log(`  Energy: ${d.details.currentEnergy}, Needed: ${d.details.energyNeeded}`);
});
```

### Track Building Decisions

```typescript
printAIDecisions('building');

// Or programmatically
const buildDecisions = summary.decisions.filter(d => d.category === 'building');
buildDecisions.forEach(d => {
  if (d.decision === 'Set improvement build goal') {
    console.log(`${d.details.planetName}: Building ${d.details.improvementType}`);
  }
});
```

### Analyze Combat Behavior

```typescript
const combatDecisions = summary.decisions.filter(d => d.category === 'combat');
combatDecisions.forEach(d => {
  console.log(`Turn ${d.turn}: ${d.decision}`);
  console.log(`  From: ${d.details.fromPlanet} → To: ${d.details.toPlanet}`);
  console.log(`  Strength ratio: ${d.details.strengthAdvantage}`);
});
```

### Export for External Analysis

```typescript
import { exportAIDecisionsJSON } from './testUtils';
import fs from 'fs';
import path from 'path';

// Export to JSON file in ai-decision-debugging directory
const json = exportAIDecisionsJSON();
const outputPath = path.join(__dirname, '../../ai-decision-debugging/ai-decisions-my-test.json');
fs.writeFileSync(outputPath, json);

// Can now analyze with: node analyze-ai-decisions.js
// This will process all JSON files in the ai-decision-debugging directory
```

## Analyzing Multiple Decision Files

The `analyze-ai-decisions.js` script automatically processes all JSON files in the `ai-decision-debugging` directory:

```bash
# Analyze all AI decision files
node analyze-ai-decisions.js

# Or specify a custom directory
node analyze-ai-decisions.js ./path/to/decisions
```

The script will:
- Find all `.json` files (excluding `*-summary.json` files)
- Analyze each file individually
- Generate a `-summary.json` file for each
- Display comprehensive statistics for all matchups

## Example Test

See [ai-debug-example.spec.ts](./ai-debug-example.spec.ts) for working examples.

## Direct Access (Advanced)

You can also access the ComputerPlayer methods directly:

```typescript
import { ComputerPlayer } from '../engine/computerPlayer';

// Turn on debug mode
ComputerPlayer.setDebugMode(true);

// Run your game logic...

// Get raw decisions
const decisions = ComputerPlayer.getAIDecisions();

// Clear the log
ComputerPlayer.clearAIDecisions();

// Turn off debug mode
ComputerPlayer.setDebugMode(false);
```

## What Gets Logged

### Research Decisions
- Target and adjusted research percentages
- Energy availability for builds
- Research type selections

### Building Decisions
- Improvement build goals (farms, mines, factories)
- Ship build goals (scouts, defenders, destroyers, etc.)
- Production queue additions with costs

### Combat Decisions
- Attack fleet dispatches
- Strength calculations and advantage ratios
- Coordinated multi-planet attacks

### Exploration Decisions
- Scout fleet dispatches
- Target planet selection
- Distance calculations

### Population Decisions
- Food surplus adjustments
- Worker assignments (future enhancement)

## Performance Notes

- Debug mode adds minimal overhead (~0.1ms per decision)
- Decision logs are kept in memory - clear them between long test runs
- By default, logging only occurs when `DEBUG_AI = true`

## Troubleshooting

### No decisions logged?
- Make sure you called `enableAIDebug()` before running your game
- Verify the AI is actually taking turns (computer players are active)

### Too much output?
- Use category filters: `printAIDecisions('research')`
- Use player filters: `printAIDecisions(undefined, 'Computer1')`
- Or just use `getAIDecisionSummary()` for aggregated data

### Want more details?
- Edit `computerPlayer.ts` and add more fields to the `logDecision()` calls
- The `details` object can contain any data you want to track
