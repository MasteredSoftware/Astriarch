#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/astriarch_v2';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'analysis', 'production-failures');
const DEFAULT_TOP_N = 15;

function parseArgs(argv) {
  const args = {
    mongoUrl: process.env.MONGODB_CONNECTION_STRING || DEFAULT_MONGO_URL,
    outputDir: process.env.ASTRIARCH_ANALYSIS_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    topN: DEFAULT_TOP_N,
    includeNonProduction: false,
    gameId: null,
    writeJson: true,
    writeMarkdown: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mongo-url' && argv[i + 1]) {
      args.mongoUrl = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--mongo-url=')) {
      args.mongoUrl = arg.slice('--mongo-url='.length);
    } else if (arg === '--output-dir' && argv[i + 1]) {
      args.outputDir = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--output-dir=')) {
      args.outputDir = arg.slice('--output-dir='.length);
    } else if (arg === '--top' && argv[i + 1]) {
      args.topN = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--top=')) {
      args.topN = Number(arg.slice('--top='.length));
    } else if (arg === '--game-id' && argv[i + 1]) {
      args.gameId = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--game-id=')) {
      args.gameId = arg.slice('--game-id='.length);
    } else if (arg === '--include-non-production') {
      args.includeNonProduction = true;
    } else if (arg === '--json-only') {
      args.writeMarkdown = false;
    } else if (arg === '--markdown-only') {
      args.writeJson = false;
    }
  }

  if (!Number.isFinite(args.topN) || args.topN <= 0) {
    args.topN = DEFAULT_TOP_N;
  }

  return args;
}

function toId(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function topEntries(map, topN) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
}

function percent(part, total) {
  if (!total) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function shipTypeLabel(type) {
  const labels = {
    1: 'SystemDefense',
    2: 'Scout',
    3: 'Destroyer',
    4: 'Cruiser',
    5: 'Battleship',
    6: 'SpacePlatform',
  };
  return labels[type] || `Type${String(type ?? 'Unknown')}`;
}

function playerIndex(games) {
  const idx = new Map();
  for (const game of games) {
    const gameId = toId(game._id);
    const players = Array.isArray(game.players) ? game.players : [];
    for (const p of players) {
      const playerId = p.Id || p.id;
      if (!playerId) continue;
      idx.set(`${gameId}:${playerId}`, {
        playerName: p.name || playerId,
        isAI: Boolean(p.isAI),
        gameName: game.name || gameId,
      });
    }
  }
  return idx;
}

function summarize(failures, pIndex, topN) {
  const byCommandType = new Map();
  const byError = new Map();
  const byGame = new Map();
  const byPlayer = new Map();
  const byAiBucket = new Map([
    ['AI', 0],
    ['Human', 0],
    ['Unknown', 0],
  ]);
  const byPlanet = new Map();
  const byItemType = new Map();
  const byShipType = new Map();
  const byImprovementType = new Map();
  const byClientCycleBucket = new Map();

  for (const f of failures) {
    const gameId = f.gameId;
    const key = `${gameId}:${f.playerId}`;
    const playerMeta = pIndex.get(key);
    const aiBucket = playerMeta == null ? 'Unknown' : playerMeta.isAI ? 'AI' : 'Human';

    inc(byCommandType, f.commandType || 'UNKNOWN');
    inc(byError, `${f.errorCode || 'NO_CODE'}::${f.errorMessage || 'No message'}`);
    inc(byGame, `${playerMeta?.gameName || gameId}::${gameId}`);
    inc(byPlayer, `${playerMeta?.playerName || f.playerId}::${f.playerId}::${gameId}`);
    inc(byAiBucket, aiBucket);

    const planetId = f.command?.planetId;
    if (planetId != null) {
      inc(byPlanet, `${gameId}::planet_${planetId}`);
    }

    const itemType = f.command?.productionItem?.itemType;
    if (itemType != null) {
      const itemLabel = itemType === 1 ? 'Improvement' : itemType === 2 ? 'Ship' : `ItemType${itemType}`;
      inc(byItemType, itemLabel);
    }

    const starshipType = f.command?.productionItem?.starshipData?.type;
    if (starshipType != null) {
      inc(byShipType, shipTypeLabel(starshipType));
    }

    const improvementType = f.command?.productionItem?.improvementData?.type;
    if (improvementType != null) {
      inc(byImprovementType, `ImprovementType${String(improvementType)}`);
    }

    const cycle = Number(f.command?.clientCycle);
    if (Number.isFinite(cycle)) {
      const bucketStart = Math.floor(cycle / 10) * 10;
      const bucketLabel = `${bucketStart}-${bucketStart + 9.99}`;
      inc(byClientCycleBucket, bucketLabel);
    }
  }

  return {
    totalFailures: failures.length,
    byCommandType: Object.fromEntries([...byCommandType.entries()].sort((a, b) => b[1] - a[1])),
    byError: Object.fromEntries([...byError.entries()].sort((a, b) => b[1] - a[1])),
    byGame: topEntries(byGame, topN).map(([key, count]) => ({ key, count })),
    byPlayer: topEntries(byPlayer, topN).map(([key, count]) => ({ key, count })),
    byAiBucket: Object.fromEntries(byAiBucket.entries()),
    byPlanet: topEntries(byPlanet, topN).map(([key, count]) => ({ key, count })),
    byItemType: Object.fromEntries([...byItemType.entries()].sort((a, b) => b[1] - a[1])),
    byShipType: Object.fromEntries([...byShipType.entries()].sort((a, b) => b[1] - a[1])),
    byImprovementType: Object.fromEntries([...byImprovementType.entries()].sort((a, b) => b[1] - a[1])),
    byClientCycleBucket: Object.fromEntries([...byClientCycleBucket.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Production Failure Deep Dive');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Database: ${report.database}`);
  lines.push(`Scope: ${report.scopeDescription}`);
  lines.push('');

  lines.push('## Summary');
  lines.push(`- Total failed commands analyzed: ${report.summary.totalFailures}`);
  lines.push(`- AI failures: ${report.summary.byAiBucket.AI || 0} (${percent(report.summary.byAiBucket.AI || 0, report.summary.totalFailures)})`);
  lines.push(`- Human failures: ${report.summary.byAiBucket.Human || 0} (${percent(report.summary.byAiBucket.Human || 0, report.summary.totalFailures)})`);
  lines.push(`- Unknown actor failures: ${report.summary.byAiBucket.Unknown || 0}`);
  lines.push('');

  lines.push('## Failed Command Types');
  for (const [type, count] of Object.entries(report.summary.byCommandType)) {
    lines.push(`- ${type}: ${count}`);
  }
  lines.push('');

  lines.push('## Top Failure Reasons');
  for (const [reason, count] of Object.entries(report.summary.byError).slice(0, report.topN)) {
    lines.push(`- ${reason}: ${count}`);
  }
  lines.push('');

  lines.push('## Production Item Detail');
  for (const [itemType, count] of Object.entries(report.summary.byItemType)) {
    lines.push(`- ${itemType}: ${count}`);
  }
  for (const [shipType, count] of Object.entries(report.summary.byShipType)) {
    lines.push(`- Ship ${shipType}: ${count}`);
  }
  for (const [improvementType, count] of Object.entries(report.summary.byImprovementType)) {
    lines.push(`- ${improvementType}: ${count}`);
  }
  lines.push('');

  lines.push('## Top Games By Failures');
  for (const row of report.summary.byGame) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  lines.push('');

  lines.push('## Top Players By Failures');
  for (const row of report.summary.byPlayer) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  lines.push('');

  lines.push('## Cycle Buckets (Client Cycle)');
  for (const [bucket, count] of Object.entries(report.summary.byClientCycleBucket)) {
    lines.push(`- ${bucket}: ${count}`);
  }
  lines.push('');

  lines.push('## Top Planets With Failures');
  for (const row of report.summary.byPlanet) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  lines.push('');

  lines.push('## Example Failure Commands');
  for (const sample of report.samples) {
    lines.push(`- game ${sample.gameId}, seq ${sample.sequenceNumber}, player ${sample.playerId}, ${sample.commandType}, ${sample.errorCode || 'NO_CODE'}: ${sample.errorMessage || 'No message'}`);
  }
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outputDir, { recursive: true });

  await mongoose.connect(args.mongoUrl);
  try {
    const db = mongoose.connection.db;
    const gameQuery = args.gameId ? { _id: args.gameId } : {};
    const games = await db.collection('games').find(gameQuery).toArray();
    const gameIds = games.map((g) => toId(g._id));

    if (gameIds.length === 0) {
      console.log('No matching games found.');
      return;
    }

    const failureQuery = {
      gameId: { $in: gameIds },
      resultSuccess: false,
      ...(args.includeNonProduction ? {} : { commandType: 'QUEUE_PRODUCTION_ITEM' }),
    };

    const failures = await db.collection('gamecommandlogs').find(failureQuery).toArray();
    const pIdx = playerIndex(games);
    const summary = summarize(failures, pIdx, args.topN);

    const report = {
      generatedAt: new Date().toISOString(),
      database: args.mongoUrl,
      topN: args.topN,
      scopeDescription: args.includeNonProduction
        ? `${gameIds.length} game(s), all failed command types`
        : `${gameIds.length} game(s), failed QUEUE_PRODUCTION_ITEM only`,
      filters: {
        gameId: args.gameId,
        includeNonProduction: args.includeNonProduction,
      },
      summary,
      samples: failures.slice(0, args.topN).map((f) => ({
        gameId: f.gameId,
        sequenceNumber: f.sequenceNumber,
        playerId: f.playerId,
        commandType: f.commandType,
        errorCode: f.errorCode,
        errorMessage: f.errorMessage,
        command: f.command,
      })),
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scope = args.gameId ? `game-${args.gameId}` : 'all-games';
    const mode = args.includeNonProduction ? 'all-failures' : 'production-only';
    const jsonPath = path.join(args.outputDir, `${stamp}-${scope}-${mode}.json`);
    const mdPath = path.join(args.outputDir, `${stamp}-${scope}-${mode}.md`);

    if (args.writeJson) {
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    }
    if (args.writeMarkdown) {
      fs.writeFileSync(mdPath, buildMarkdown(report));
    }

    console.log(buildMarkdown(report));
    if (args.writeJson) {
      console.log(`\nJSON report written to ${jsonPath}`);
    }
    if (args.writeMarkdown) {
      console.log(`Markdown report written to ${mdPath}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[analyze-production-failures] failed:', error);
  process.exit(1);
});
