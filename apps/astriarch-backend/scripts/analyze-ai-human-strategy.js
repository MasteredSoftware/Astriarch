#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/astriarch_v2';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'analysis', 'ai-human-strategy');
const DEFAULT_TOP_N = 12;

function parseArgs(argv) {
  const args = {
    mongoUrl: process.env.MONGODB_CONNECTION_STRING || DEFAULT_MONGO_URL,
    outputDir: process.env.ASTRIARCH_ANALYSIS_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    topN: DEFAULT_TOP_N,
    gameId: null,
    cycleBucketSize: 20,
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
    } else if (arg === '--cycle-bucket-size' && argv[i + 1]) {
      args.cycleBucketSize = Number(argv[i + 1]) || args.cycleBucketSize;
      i += 1;
    } else if (arg.startsWith('--cycle-bucket-size=')) {
      args.cycleBucketSize = Number(arg.slice('--cycle-bucket-size='.length)) || args.cycleBucketSize;
    }
  }

  if (!Number.isFinite(args.topN) || args.topN <= 0) {
    args.topN = DEFAULT_TOP_N;
  }
  if (!Number.isFinite(args.cycleBucketSize) || args.cycleBucketSize <= 0) {
    args.cycleBucketSize = 20;
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

function pct(value, total) {
  if (!total) return 0;
  return value / total;
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function playerMetaIndex(games) {
  const idx = new Map();
  for (const game of games) {
    const gameId = toId(game._id);
    const players = Array.isArray(game.players) ? game.players : [];
    const gameStatePlayers = Array.isArray(game.gameState?.players) ? game.gameState.players : [];

    for (const p of players) {
      const playerId = p.Id || p.id;
      if (!playerId) continue;
      idx.set(`${gameId}:${playerId}`, {
        gameId,
        playerId,
        name: p.name || playerId,
        isAI: Boolean(p.isAI),
      });
    }

    for (const p of gameStatePlayers) {
      const playerId = p.id || p.Id;
      if (!playerId) continue;
      const key = `${gameId}:${playerId}`;
      if (!idx.has(key)) {
        idx.set(key, {
          gameId,
          playerId,
          name: p.name || playerId,
          isAI: Boolean(p.type === 1 || p.type === 2 || p.type === 3 || p.type === 4),
        });
      }
    }
  }
  return idx;
}

function summarize(games, commands, events, topN, cycleBucketSize) {
  const playerIdx = playerMetaIndex(games);

  const cohorts = {
    AI: {
      commands: 0,
      failures: 0,
      byType: new Map(),
      sendShipsOrders: 0,
      launchedShipCount: 0,
      capturedPlanets: 0,
      lostPlanets: 0,
      tradesSubmitted: 0,
      researchQueued: 0,
      researchPercentAdjusted: 0,
      byCycleBucket: new Map(),
    },
    Human: {
      commands: 0,
      failures: 0,
      byType: new Map(),
      sendShipsOrders: 0,
      launchedShipCount: 0,
      capturedPlanets: 0,
      lostPlanets: 0,
      tradesSubmitted: 0,
      researchQueued: 0,
      researchPercentAdjusted: 0,
      byCycleBucket: new Map(),
    },
    Unknown: {
      commands: 0,
      failures: 0,
      byType: new Map(),
      sendShipsOrders: 0,
      launchedShipCount: 0,
      capturedPlanets: 0,
      lostPlanets: 0,
      tradesSubmitted: 0,
      researchQueued: 0,
      researchPercentAdjusted: 0,
      byCycleBucket: new Map(),
    },
  };

  const playerCommandCounts = new Map();
  const playerAggression = new Map();

  for (const c of commands) {
    const playerKey = `${c.gameId}:${c.playerId}`;
    const meta = playerIdx.get(playerKey);
    const cohortName = meta == null ? 'Unknown' : meta.isAI ? 'AI' : 'Human';
    const cohort = cohorts[cohortName];

    cohort.commands += 1;
    if (!c.resultSuccess) cohort.failures += 1;
    inc(cohort.byType, c.commandType || 'UNKNOWN');

    const cycle = Number(c.command?.clientCycle ?? c.gameCycle);
    if (Number.isFinite(cycle)) {
      const start = Math.floor(cycle / cycleBucketSize) * cycleBucketSize;
      const label = `${start}-${start + cycleBucketSize - 0.01}`;
      inc(cohort.byCycleBucket, label);
    }

    if (c.commandType === 'SEND_SHIPS') {
      cohort.sendShipsOrders += 1;
      const shipIds = c.command?.shipIds || {};
      const launched =
        (Array.isArray(shipIds.scouts) ? shipIds.scouts.length : 0) +
        (Array.isArray(shipIds.destroyers) ? shipIds.destroyers.length : 0) +
        (Array.isArray(shipIds.cruisers) ? shipIds.cruisers.length : 0) +
        (Array.isArray(shipIds.battleships) ? shipIds.battleships.length : 0);
      cohort.launchedShipCount += launched;
    }
    if (c.commandType === 'SUBMIT_TRADE') cohort.tradesSubmitted += 1;
    if (c.commandType === 'SUBMIT_RESEARCH_ITEM') cohort.researchQueued += 1;
    if (c.commandType === 'ADJUST_RESEARCH_PERCENT') cohort.researchPercentAdjusted += 1;

    const currentPlayer = playerCommandCounts.get(playerKey) || {
      gameId: c.gameId,
      playerId: c.playerId,
      playerName: meta?.name || c.playerId,
      cohort: cohortName,
      totalCommands: 0,
      sendShips: 0,
      trades: 0,
      research: 0,
      failures: 0,
    };
    currentPlayer.totalCommands += 1;
    if (c.commandType === 'SEND_SHIPS') currentPlayer.sendShips += 1;
    if (c.commandType === 'SUBMIT_TRADE') currentPlayer.trades += 1;
    if (c.commandType === 'SUBMIT_RESEARCH_ITEM' || c.commandType === 'ADJUST_RESEARCH_PERCENT') currentPlayer.research += 1;
    if (!c.resultSuccess) currentPlayer.failures += 1;
    playerCommandCounts.set(playerKey, currentPlayer);
  }

  for (const e of events) {
    if (e.eventType === 'PLANET_CAPTURED') {
      const attackingId = e.payload?.data?.conflictData?.attackingClientPlayer?.id || e.sourcePlayerId;
      const meta = playerIdx.get(`${e.gameId}:${attackingId}`);
      const cohortName = meta == null ? 'Unknown' : meta.isAI ? 'AI' : 'Human';
      cohorts[cohortName].capturedPlanets += 1;
    }

    if (e.eventType === 'PLANET_LOST') {
      const ownerId = e.payload?.data?.conflictData?.defendingClientPlayer?.id || e.sourcePlayerId;
      const meta = playerIdx.get(`${e.gameId}:${ownerId}`);
      const cohortName = meta == null ? 'Unknown' : meta.isAI ? 'AI' : 'Human';
      cohorts[cohortName].lostPlanets += 1;
    }
  }

  for (const entry of playerCommandCounts.values()) {
    const aggression = entry.totalCommands > 0 ? entry.sendShips / entry.totalCommands : 0;
    const trading = entry.totalCommands > 0 ? entry.trades / entry.totalCommands : 0;
    const research = entry.totalCommands > 0 ? entry.research / entry.totalCommands : 0;
    playerAggression.set(`${entry.playerName}::${entry.playerId}::${entry.gameId}`, {
      ...entry,
      aggression,
      trading,
      research,
      failureRate: entry.totalCommands > 0 ? entry.failures / entry.totalCommands : 0,
    });
  }

  const byCohort = {};
  for (const cohortName of ['AI', 'Human', 'Unknown']) {
    const c = cohorts[cohortName];
    byCohort[cohortName] = {
      commands: c.commands,
      failures: c.failures,
      failureRate: pct(c.failures, c.commands),
      sendShipsOrders: c.sendShipsOrders,
      sendShipsRate: pct(c.sendShipsOrders, c.commands),
      launchedShipCount: c.launchedShipCount,
      avgShipsPerSendOrder: pct(c.launchedShipCount, c.sendShipsOrders),
      capturedPlanets: c.capturedPlanets,
      lostPlanets: c.lostPlanets,
      captureToLossRatio: c.lostPlanets > 0 ? c.capturedPlanets / c.lostPlanets : c.capturedPlanets,
      tradesSubmitted: c.tradesSubmitted,
      tradeRate: pct(c.tradesSubmitted, c.commands),
      researchQueued: c.researchQueued,
      researchPercentAdjusted: c.researchPercentAdjusted,
      commandMix: Object.fromEntries([...c.byType.entries()].sort((a, b) => b[1] - a[1])),
      cycleBuckets: Object.fromEntries([...c.byCycleBucket.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    };
  }

  return {
    byCohort,
    topAggressivePlayers: [...playerAggression.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .filter((x) => x.totalCommands >= 25)
      .sort((a, b) => b.aggression - a.aggression)
      .slice(0, topN),
    topTradingPlayers: [...playerAggression.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .filter((x) => x.totalCommands >= 25)
      .sort((a, b) => b.trading - a.trading)
      .slice(0, topN),
    topResearchPlayers: [...playerAggression.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .filter((x) => x.totalCommands >= 25)
      .sort((a, b) => b.research - a.research)
      .slice(0, topN),
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# AI vs Human Strategy Analysis');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Database: ${report.database}`);
  lines.push(`Scope: ${report.scopeDescription}`);
  lines.push('');

  lines.push('## Cohort Summary');
  for (const cohortName of ['AI', 'Human', 'Unknown']) {
    const c = report.summary.byCohort[cohortName];
    lines.push(`- ${cohortName}: commands=${c.commands}, failureRate=${formatPct(c.failureRate)}, sendRate=${formatPct(c.sendShipsRate)}, avgShipsPerSend=${c.avgShipsPerSendOrder.toFixed(2)}, captures=${c.capturedPlanets}, losses=${c.lostPlanets}, trades=${c.tradesSubmitted}, researchAdjust=${c.researchPercentAdjusted}`);
  }
  lines.push('');

  lines.push('## AI Command Mix');
  for (const [type, count] of Object.entries(report.summary.byCohort.AI.commandMix).slice(0, report.topN)) {
    lines.push(`- ${type}: ${count}`);
  }
  lines.push('');

  lines.push('## Human Command Mix');
  for (const [type, count] of Object.entries(report.summary.byCohort.Human.commandMix).slice(0, report.topN)) {
    lines.push(`- ${type}: ${count}`);
  }
  lines.push('');

  lines.push('## Top Aggressive Players (SEND_SHIPS ratio)');
  for (const row of report.summary.topAggressivePlayers) {
    lines.push(`- ${row.playerName} (${row.cohort}) game ${row.gameId}: aggression=${formatPct(row.aggression)}, commands=${row.totalCommands}, failures=${formatPct(row.failureRate)}`);
  }
  lines.push('');

  lines.push('## Top Trading Players');
  for (const row of report.summary.topTradingPlayers) {
    lines.push(`- ${row.playerName} (${row.cohort}) game ${row.gameId}: trading=${formatPct(row.trading)}, commands=${row.totalCommands}`);
  }
  lines.push('');

  lines.push('## Top Research-Focused Players');
  for (const row of report.summary.topResearchPlayers) {
    lines.push(`- ${row.playerName} (${row.cohort}) game ${row.gameId}: research=${formatPct(row.research)}, commands=${row.totalCommands}`);
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
    if (games.length === 0) {
      console.log('No matching games found.');
      return;
    }

    const gameIds = games.map((g) => toId(g._id));
    const commands = await db.collection('gamecommandlogs').find({ gameId: { $in: gameIds } }).toArray();
    const events = await db.collection('gameevents').find({ gameId: { $in: gameIds } }).toArray();

    const summary = summarize(games, commands, events, args.topN, args.cycleBucketSize);
    const report = {
      generatedAt: new Date().toISOString(),
      database: args.mongoUrl,
      topN: args.topN,
      filters: {
        gameId: args.gameId,
        cycleBucketSize: args.cycleBucketSize,
      },
      scopeDescription: `${games.length} game(s), ${commands.length} commands, ${events.length} events`,
      summary,
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scope = args.gameId ? `game-${args.gameId}` : 'all-games';
    const jsonPath = path.join(args.outputDir, `${stamp}-${scope}.json`);
    const mdPath = path.join(args.outputDir, `${stamp}-${scope}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(mdPath, buildMarkdown(report));

    console.log(buildMarkdown(report));
    console.log('');
    console.log(`JSON report written to ${jsonPath}`);
    console.log(`Markdown report written to ${mdPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[analyze-ai-human-strategy] failed:', error);
  process.exit(1);
});
