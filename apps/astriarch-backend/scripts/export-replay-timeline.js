#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/astriarch_v2';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'analysis', 'replay-timelines');

function parseArgs(argv) {
  const args = {
    mongoUrl: process.env.MONGODB_CONNECTION_STRING || DEFAULT_MONGO_URL,
    outputDir: process.env.ASTRIARCH_ANALYSIS_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    gameId: null,
    topGamesFallback: 10,
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
    } else if (arg === '--game-id' && argv[i + 1]) {
      args.gameId = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--game-id=')) {
      args.gameId = arg.slice('--game-id='.length);
    } else if (arg === '--top-games-fallback' && argv[i + 1]) {
      args.topGamesFallback = Number(argv[i + 1]) || args.topGamesFallback;
      i += 1;
    } else if (arg.startsWith('--top-games-fallback=')) {
      args.topGamesFallback = Number(arg.slice('--top-games-fallback='.length)) || args.topGamesFallback;
    }
  }

  return args;
}

function toId(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

function buildIdCandidates(id) {
  const candidates = [id];
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    candidates.push(new mongoose.Types.ObjectId(id));
  }
  return candidates;
}

function bySeqThenKind(a, b) {
  if (a.sequenceNumber !== b.sequenceNumber) {
    return a.sequenceNumber - b.sequenceNumber;
  }
  if (a.kind === b.kind) return 0;
  return a.kind === 'command' ? -1 : 1;
}

function percent(part, total) {
  if (!total) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function detectGaps(sequenceNumbers) {
  if (sequenceNumbers.length === 0) {
    return { min: null, max: null, missingCount: 0, duplicates: [] };
  }
  const sorted = [...sequenceNumbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const seen = new Map();
  for (const seq of sorted) {
    seen.set(seq, (seen.get(seq) || 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([sequenceNumber, count]) => ({ sequenceNumber, count }));
  const missingCount = Math.max(0, max - min + 1 - seen.size);
  return { min, max, missingCount, duplicates };
}

function summarizeTimeline(game, timelineEntries, commands, events) {
  const integrity = detectGaps(timelineEntries.map((e) => e.sequenceNumber));
  const commandSuccess = commands.filter((c) => c.resultSuccess).length;
  const commandFailures = commands.length - commandSuccess;
  const commandIdsWithEvents = new Set(events.filter((e) => e.sourceCommandId != null).map((e) => e.sourceCommandId));
  const commandsWithoutEvents = commands.filter((c) => !commandIdsWithEvents.has(c.commandId)).length;
  const serverEvents = events.filter((e) => e.sourcePlayerId === 'server').length;

  return {
    gameId: toId(game._id),
    gameName: game.name || toId(game._id),
    status: game.status || 'unknown',
    currentCycle: game.gameState?.currentCycle ?? null,
    commands: commands.length,
    events: events.length,
    commandSuccess,
    commandFailures,
    commandFailureRate: commands.length > 0 ? commandFailures / commands.length : 0,
    commandsWithoutEvents,
    commandsWithoutEventsRate: commands.length > 0 ? commandsWithoutEvents / commands.length : 0,
    serverEvents,
    sequence: integrity,
    firstTimestamp: timelineEntries[0]?.timestamp || null,
    lastTimestamp: timelineEntries[timelineEntries.length - 1]?.timestamp || null,
    firstEntries: timelineEntries.slice(0, 20),
    lastEntries: timelineEntries.slice(-20),
  };
}

function buildMarkdown(summary) {
  const lines = [];
  lines.push('# Replay Timeline Export');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Game: ${summary.gameName} (${summary.gameId})`);
  lines.push(`Status: ${summary.status}`);
  lines.push('');

  lines.push('## Summary');
  lines.push(`- Current cycle: ${summary.currentCycle ?? 'n/a'}`);
  lines.push(`- Commands: ${summary.commands}`);
  lines.push(`- Events: ${summary.events}`);
  lines.push(`- Successful commands: ${summary.commandSuccess}`);
  lines.push(`- Failed commands: ${summary.commandFailures} (${percent(summary.commandFailures, summary.commands)})`);
  lines.push(`- Commands without events: ${summary.commandsWithoutEvents} (${percent(summary.commandsWithoutEvents, summary.commands)})`);
  lines.push(`- Server events: ${summary.serverEvents}`);
  lines.push(`- Sequence min/max: ${summary.sequence.min ?? 'n/a'} / ${summary.sequence.max ?? 'n/a'}`);
  lines.push(`- Sequence gaps: ${summary.sequence.missingCount}`);
  lines.push(`- Sequence duplicates: ${summary.sequence.duplicates.length}`);
  lines.push('');

  lines.push('## First Timeline Entries');
  for (const entry of summary.firstEntries) {
    lines.push(`- seq ${entry.sequenceNumber}: ${entry.kind} ${entry.type} (player ${entry.playerId || entry.sourcePlayerId || 'n/a'})`);
  }
  lines.push('');

  lines.push('## Last Timeline Entries');
  for (const entry of summary.lastEntries) {
    lines.push(`- seq ${entry.sequenceNumber}: ${entry.kind} ${entry.type} (player ${entry.playerId || entry.sourcePlayerId || 'n/a'})`);
  }
  lines.push('');

  return lines.join('\n');
}

async function chooseGameId(db, args) {
  if (args.gameId) {
    return args.gameId;
  }

  const topGames = await db.collection('gamecommandlogs').aggregate([
    { $group: { _id: '$gameId', commandCount: { $sum: 1 } } },
    { $sort: { commandCount: -1 } },
    { $limit: args.topGamesFallback },
  ]).toArray();

  if (topGames.length === 0) {
    return null;
  }

  const ids = topGames.map((g) => toId(g._id));
  const idCandidates = ids.flatMap((id) => buildIdCandidates(id));
  const existingGames = await db.collection('games').find({ _id: { $in: idCandidates } }, { projection: { _id: 1 } }).toArray();
  const existingSet = new Set(existingGames.map((g) => toId(g._id)));
  const preferred = topGames.find((g) => existingSet.has(toId(g._id)));

  return toId(preferred?._id || topGames[0]._id);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outputDir, { recursive: true });

  await mongoose.connect(args.mongoUrl);
  try {
    const db = mongoose.connection.db;
    const gameId = await chooseGameId(db, args);
    if (!gameId) {
      console.log('No gamecommandlogs found; cannot export timeline.');
      return;
    }

    const gameDoc = await db.collection('games').findOne({ _id: { $in: buildIdCandidates(gameId) } });

    const commands = await db.collection('gamecommandlogs').find({ gameId }).sort({ sequenceNumber: 1 }).toArray();
    const events = await db.collection('gameevents').find({ gameId }).sort({ sequenceNumber: 1 }).toArray();

    const timelineEntries = [
      ...commands.map((c) => ({
        kind: 'command',
        sequenceNumber: c.sequenceNumber,
        timestamp: c.timestamp,
        gameCycle: c.gameCycle,
        commandId: c.commandId,
        playerId: c.playerId,
        type: c.commandType,
        resultSuccess: c.resultSuccess,
        errorCode: c.errorCode,
        errorMessage: c.errorMessage,
        payload: c.command,
      })),
      ...events.map((e) => ({
        kind: 'event',
        sequenceNumber: e.sequenceNumber,
        timestamp: e.timestamp,
        gameCycle: e.gameCycle,
        eventId: e.eventId,
        sourcePlayerId: e.sourcePlayerId,
        sourceCommandId: e.sourceCommandId,
        type: e.eventType,
        affectedPlayerIds: e.affectedPlayerIds,
        payload: e.payload,
      })),
    ].sort(bySeqThenKind);

    const game =
      gameDoc ||
      {
        _id: gameId,
        name: '(orphaned logs)',
        status: 'unknown',
        gameState: {
          currentCycle: null,
        },
      };

    const summary = summarizeTimeline(game, timelineEntries, commands, events);
    const report = {
      generatedAt: new Date().toISOString(),
      database: args.mongoUrl,
      gameId,
      summary,
      timeline: timelineEntries,
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${stamp}-game-${gameId}`;
    const jsonPath = path.join(args.outputDir, `${baseName}.timeline.json`);
    const ndjsonPath = path.join(args.outputDir, `${baseName}.timeline.ndjson`);
    const mdPath = path.join(args.outputDir, `${baseName}.summary.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(ndjsonPath, timelineEntries.map((entry) => JSON.stringify(entry)).join('\n'));
    fs.writeFileSync(mdPath, buildMarkdown(summary));

    console.log(buildMarkdown(summary));
    console.log('');
    console.log(`Timeline JSON written to ${jsonPath}`);
    console.log(`Timeline NDJSON written to ${ndjsonPath}`);
    console.log(`Summary markdown written to ${mdPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[export-replay-timeline] failed:', error);
  process.exit(1);
});
