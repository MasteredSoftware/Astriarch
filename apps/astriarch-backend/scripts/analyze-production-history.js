#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/astriarch_v2';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'analysis', 'production-history');
const DEFAULT_TOP_N = 10;

function parseArgs(argv) {
  const args = {
    mongoUrl: process.env.MONGODB_CONNECTION_STRING || DEFAULT_MONGO_URL,
    outputDir: process.env.ASTRIARCH_ANALYSIS_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    gameId: null,
    topN: DEFAULT_TOP_N,
    writeJson: true,
    writeMarkdown: true,
    pretty: true,
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
    } else if (arg === '--top' && argv[i + 1]) {
      args.topN = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--top=')) {
      args.topN = Number(arg.slice('--top='.length));
    } else if (arg === '--json-only') {
      args.writeMarkdown = false;
    } else if (arg === '--markdown-only') {
      args.writeJson = false;
    } else if (arg === '--compact') {
      args.pretty = false;
    }
  }

  if (!Number.isFinite(args.topN) || args.topN <= 0) {
    args.topN = DEFAULT_TOP_N;
  }

  return args;
}

function toObjectIdString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.toString) return value.toString();
  return String(value);
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }
  return map;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

function formatNumber(value, digits = 1) {
  return Number(value).toFixed(digits);
}

function formatPercent(value, digits = 1) {
  return `${formatNumber(value * 100, digits)}%`;
}

function topEntries(map, limit = DEFAULT_TOP_N, comparator = (a, b) => b[1] - a[1]) {
  return [...map.entries()].sort(comparator).slice(0, limit);
}

function commandLabel(commandType) {
  const labels = {
    ADJUST_RESEARCH_PERCENT: 'Research %',
    CLEAR_WAYPOINT: 'Clear waypoint',
    DEMOLISH_IMPROVEMENT: 'Demolish improvement',
    QUEUE_PRODUCTION_ITEM: 'Queue production',
    REMOVE_PRODUCTION_ITEM: 'Remove production',
    SEND_SHIPS: 'Send ships',
    SET_WAYPOINT: 'Set waypoint',
    SUBMIT_RESEARCH_ITEM: 'Queue research',
    SUBMIT_TRADE: 'Submit trade',
    UPDATE_PLANET_WORKER_ASSIGNMENTS: 'Update workers',
  };

  return labels[commandType] || commandType;
}

function errorLabel(command) {
  if (!command.resultSuccess) {
    return command.errorCode || command.errorMessage || 'Unknown failure';
  }

  return 'success';
}

function buildPlayerIndex(gameDocs) {
  const players = new Map();

  for (const game of gameDocs) {
    const gameId = toObjectIdString(game._id);
    const sourcePlayers = Array.isArray(game.players) ? game.players : [];
    const gameStatePlayers = Array.isArray(game.gameState?.players) ? game.gameState.players : [];

    for (const player of sourcePlayers) {
      const playerId = player.Id || player.id;
      if (!playerId) continue;

      players.set(`${gameId}:${playerId}`, {
        gameId,
        playerId,
        name: player.name || playerId,
        isAI: Boolean(player.isAI),
        destroyed: Boolean(player.destroyed),
        position: player.position,
      });
    }

    for (const player of gameStatePlayers) {
      const playerId = player.id || player.Id;
      if (!playerId) continue;

      const key = `${gameId}:${playerId}`;
      const existing = players.get(key) || {
        gameId,
        playerId,
        name: player.name || playerId,
        isAI: Boolean(player.type === 1 || player.type === 2 || player.type === 3 || player.type === 4),
        destroyed: Boolean(player.destroyed),
      };

      players.set(key, {
        ...existing,
        name: existing.name || player.name || playerId,
        destroyed: Boolean(player.destroyed),
        points: player.points,
        type: player.type,
      });
    }
  }

  return players;
}

function buildReport(gameDocs, commandDocs, eventDocs, options) {
  const gamesById = new Map(gameDocs.map((game) => [toObjectIdString(game._id), game]));
  const playerIndex = buildPlayerIndex(gameDocs);
  const commandsByGame = groupBy(commandDocs, (command) => command.gameId);
  const eventsByGame = groupBy(eventDocs, (event) => event.gameId);

  const allGameIds = [...gamesById.keys()];
  const completedGames = gameDocs.filter((game) => game.status === 'completed');
  const activeGames = gameDocs.filter((game) => game.status !== 'completed');

  const commandCountByType = new Map();
  const eventCountByType = new Map();
  const commandCountByPlayer = new Map();
  const eventCountBySourcePlayer = new Map();
  const commandFailureByType = new Map();
  const commandFailureByPlayer = new Map();
  const commandFailureByError = new Map();
  const commandTypeByPlayer = new Map();
  const gameCommandStats = [];
  const gameEventStats = [];
  const integrityIssues = [];

  let totalSuccessCommands = 0;
  let totalFailedCommands = 0;
  let totalCommandsWithEvents = 0;
  let totalCommandsWithoutEvents = 0;
  let totalCommandEvents = 0;
  let totalServerEvents = 0;

  for (const gameId of allGameIds) {
    const game = gamesById.get(gameId);
    const commands = commandsByGame.get(gameId) || [];
    const events = eventsByGame.get(gameId) || [];
    const sequenceMap = new Map();

    const commandSequenceNumbers = commands.map((command) => command.sequenceNumber).filter(Number.isFinite);
    const eventSequenceNumbers = events.map((event) => event.sequenceNumber).filter(Number.isFinite);
    const combinedSequenceNumbers = [...commandSequenceNumbers, ...eventSequenceNumbers].sort((a, b) => a - b);

    for (const command of commands) {
      const playerKey = `${gameId}:${command.playerId}`;
      commandCountByType.set(command.commandType, (commandCountByType.get(command.commandType) || 0) + 1);
      commandCountByPlayer.set(playerKey, (commandCountByPlayer.get(playerKey) || 0) + 1);
      if (!commandTypeByPlayer.has(playerKey)) {
        commandTypeByPlayer.set(playerKey, new Map());
      }
      const perPlayerType = commandTypeByPlayer.get(playerKey);
      perPlayerType.set(command.commandType, (perPlayerType.get(command.commandType) || 0) + 1);

      if (command.resultSuccess) {
        totalSuccessCommands += 1;
      } else {
        totalFailedCommands += 1;
        commandFailureByType.set(command.commandType, (commandFailureByType.get(command.commandType) || 0) + 1);
        commandFailureByPlayer.set(playerKey, (commandFailureByPlayer.get(playerKey) || 0) + 1);
        const failureKey = `${command.commandType}::${errorLabel(command)}`;
        commandFailureByError.set(failureKey, (commandFailureByError.get(failureKey) || 0) + 1);
      }

      const eventCount = events.filter((event) => event.sourceCommandId === command.commandId).length;
      totalCommandEvents += eventCount;
      if (eventCount > 0) {
        totalCommandsWithEvents += 1;
      } else {
        totalCommandsWithoutEvents += 1;
      }

      sequenceMap.set(command.sequenceNumber, (sequenceMap.get(command.sequenceNumber) || 0) + 1);
    }

    for (const event of events) {
      eventCountByType.set(event.eventType, (eventCountByType.get(event.eventType) || 0) + 1);
      eventCountBySourcePlayer.set(event.sourcePlayerId, (eventCountBySourcePlayer.get(event.sourcePlayerId) || 0) + 1);
      if (event.sourcePlayerId === 'server') {
        totalServerEvents += 1;
      }

      sequenceMap.set(event.sequenceNumber, (sequenceMap.get(event.sequenceNumber) || 0) + 1);
    }

    const minSequence = combinedSequenceNumbers.length > 0 ? combinedSequenceNumbers[0] : null;
    const maxSequence = combinedSequenceNumbers.length > 0 ? combinedSequenceNumbers[combinedSequenceNumbers.length - 1] : null;
    const expectedSequenceCount = minSequence == null || maxSequence == null ? 0 : maxSequence - minSequence + 1;
    const uniqueSequenceCount = sequenceMap.size;
    const duplicateSequenceNumbers = [...sequenceMap.entries()]
      .filter(([, count]) => count > 1)
      .map(([sequenceNumber, count]) => ({ sequenceNumber, count }));
    const missingSequenceCount = Math.max(0, expectedSequenceCount - uniqueSequenceCount);

    if (duplicateSequenceNumbers.length > 0 || missingSequenceCount > 0) {
      integrityIssues.push({
        gameId,
        name: game?.name || gameId,
        duplicateSequenceNumbers,
        missingSequenceCount,
        minSequence,
        maxSequence,
      });
    }

    const commandFailureCount = commands.filter((command) => !command.resultSuccess).length;
    const eventCount = events.length;
    gameCommandStats.push({
      gameId,
      name: game?.name || gameId,
      status: game?.status || 'unknown',
      commandCount: commands.length,
      failureCount: commandFailureCount,
      failureRate: commands.length > 0 ? commandFailureCount / commands.length : 0,
      eventCount,
      eventsPerCommand: commands.length > 0 ? eventCount / commands.length : 0,
      eventFanOutPerSuccessfulCommand:
        commands.filter((command) => command.resultSuccess).length > 0
          ? eventCount / commands.filter((command) => command.resultSuccess).length
          : 0,
      currentCycle: game?.gameState?.currentCycle ?? null,
    });

    gameEventStats.push({
      gameId,
      name: game?.name || gameId,
      eventCount,
      serverEventCount: events.filter((event) => event.sourcePlayerId === 'server').length,
      sourcePlayers: new Set(events.map((event) => event.sourcePlayerId)).size,
    });
  }

  const commandTotals = commandDocs.length;
  const eventTotals = eventDocs.length;

  const playerSummaries = [];
  for (const [playerKey, count] of commandCountByPlayer.entries()) {
    const [gameId, playerId] = playerKey.split(':');
    const playerMeta = playerIndex.get(playerKey) || { gameId, playerId, name: playerId, isAI: null, destroyed: null };
    const byType = commandTypeByPlayer.get(playerKey) || new Map();
    const failed = commandFailureByPlayer.get(playerKey) || 0;

    playerSummaries.push({
      gameId,
      playerId,
      playerName: playerMeta.name,
      isAI: playerMeta.isAI,
      destroyed: playerMeta.destroyed,
      totalCommands: count,
      failedCommands: failed,
      failureRate: count > 0 ? failed / count : 0,
      dominantCommands: [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, value]) => ({ type, count: value })),
    });
  }

  const aiCommandCounts = playerSummaries.filter((summary) => summary.isAI === true).map((summary) => summary.totalCommands);
  const humanCommandCounts = playerSummaries.filter((summary) => summary.isAI === false).map((summary) => summary.totalCommands);

  const finalGameOutcomes = completedGames.map((game) => {
    const players = Array.isArray(game.gameState?.players) ? game.gameState.players : [];
    const survivingPlayers = players.filter((player) => !player.destroyed);
    const sortedByPoints = [...players].sort((a, b) => (b.points || 0) - (a.points || 0));
    const topPlayer = sortedByPoints[0] || null;
    const survivingLeader = [...survivingPlayers].sort((a, b) => (b.points || 0) - (a.points || 0))[0] || null;

    return {
      gameId: toObjectIdString(game._id),
      name: game.name,
      currentCycle: game.gameState?.currentCycle ?? null,
      playerCount: players.length,
      survivingPlayers: survivingPlayers.length,
      aiPlayers: (game.players || []).filter((player) => player.isAI).length,
      humanPlayers: (game.players || []).filter((player) => !player.isAI).length,
      topPlayer: topPlayer
        ? {
            id: topPlayer.id,
            name: topPlayer.name,
            points: topPlayer.points,
            destroyed: Boolean(topPlayer.destroyed),
          }
        : null,
      leadingAlivePlayer: survivingLeader
        ? {
            id: survivingLeader.id,
            name: survivingLeader.name,
            points: survivingLeader.points,
          }
        : null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    database: options.mongoUrl,
    filters: {
      gameId: options.gameId,
      topN: options.topN,
    },
    overview: {
      games: gameDocs.length,
      completedGames: completedGames.length,
      activeGames: activeGames.length,
      commands: commandTotals,
      events: eventTotals,
      commandSuccessRate: commandTotals > 0 ? totalSuccessCommands / commandTotals : 0,
      commandFailureRate: commandTotals > 0 ? totalFailedCommands / commandTotals : 0,
      commandsWithEvents: totalCommandsWithEvents,
      commandsWithoutEvents: totalCommandsWithoutEvents,
      eventCoveragePerCommand: commandTotals > 0 ? totalCommandEvents / commandTotals : 0,
      serverEvents: totalServerEvents,
    },
    integrity: {
      duplicateSequenceGames: integrityIssues.length,
      duplicateSequenceGamesSample: integrityIssues.slice(0, options.topN),
      commandSequenceCollisions: integrityIssues.reduce((total, issue) => total + issue.duplicateSequenceNumbers.length, 0),
      expectedSequenceContinuityGaps: integrityIssues.reduce((total, issue) => total + issue.missingSequenceCount, 0),
    },
    commandAnalysis: {
      byType: Object.fromEntries([...commandCountByType.entries()].sort((a, b) => b[1] - a[1])),
      byPlayer: Object.fromEntries([...commandCountByPlayer.entries()].sort((a, b) => b[1] - a[1])),
      failuresByType: Object.fromEntries([...commandFailureByType.entries()].sort((a, b) => b[1] - a[1])),
      failuresByError: Object.fromEntries([...commandFailureByError.entries()].sort((a, b) => b[1] - a[1])),
      topFailedPlayers: playerSummaries
        .filter((summary) => summary.failedCommands > 0)
        .sort((a, b) => b.failedCommands - a.failedCommands)
        .slice(0, options.topN),
      playerSummaries: playerSummaries.sort((a, b) => b.totalCommands - a.totalCommands),
    },
    eventAnalysis: {
      byType: Object.fromEntries([...eventCountByType.entries()].sort((a, b) => b[1] - a[1])),
      bySourcePlayer: Object.fromEntries([...eventCountBySourcePlayer.entries()].sort((a, b) => b[1] - a[1])),
      topEventTypes: topEntries(eventCountByType, options.topN).map(([type, count]) => ({ type, count })),
      topSourcePlayers: topEntries(eventCountBySourcePlayer, options.topN).map(([sourcePlayerId, count]) => ({ sourcePlayerId, count })),
    },
    replayReadiness: {
      sequenceIntegrityProblems: integrityIssues,
      gamesWithSequenceProblems: integrityIssues.length,
      commandsWithNoEvents: totalCommandsWithoutEvents,
      commandsWithEvents: totalCommandsWithEvents,
      commandsWithoutEventsShare: commandTotals > 0 ? totalCommandsWithoutEvents / commandTotals : 0,
    },
    strategySignals: {
      completedGames: finalGameOutcomes,
      aiCommandDistribution: {
        averageCommandsPerPlayer: aiCommandCounts.length > 0 ? average(aiCommandCounts) : 0,
        medianCommandsPerPlayer: aiCommandCounts.length > 0 ? median(aiCommandCounts) : 0,
        p90CommandsPerPlayer: aiCommandCounts.length > 0 ? percentile(aiCommandCounts, 90) : 0,
      },
      humanCommandDistribution: {
        averageCommandsPerPlayer: humanCommandCounts.length > 0 ? average(humanCommandCounts) : 0,
        medianCommandsPerPlayer: humanCommandCounts.length > 0 ? median(humanCommandCounts) : 0,
        p90CommandsPerPlayer: humanCommandCounts.length > 0 ? percentile(humanCommandCounts, 90) : 0,
      },
      topGamesByCommands: [...gameCommandStats].sort((a, b) => b.commandCount - a.commandCount).slice(0, options.topN),
      highestFailureGames: [...gameCommandStats]
        .filter((game) => game.failureCount > 0)
        .sort((a, b) => b.failureRate - a.failureRate)
        .slice(0, options.topN),
      longestGames: [...gameCommandStats]
        .filter((game) => game.currentCycle != null)
        .sort((a, b) => (b.currentCycle || 0) - (a.currentCycle || 0))
        .slice(0, options.topN),
    },
    datasetNotes: {
      gamesWithMixedHumanAI: gameDocs.filter((game) => {
        const players = Array.isArray(game.players) ? game.players : [];
        const hasAI = players.some((player) => player.isAI);
        const hasHuman = players.some((player) => !player.isAI);
        return hasAI && hasHuman;
      }).length,
      completedGamesWithTopPlayerData: finalGameOutcomes.filter((game) => game.topPlayer != null).length,
      commandStatsByGame: gameCommandStats,
      eventStatsByGame: gameEventStats,
    },
  };
}

function buildMarkdown(report) {
  const lines = [];

  lines.push('# Astriarch Production History Analysis');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Database: ${report.database}`);
  lines.push('');

  lines.push('## Overview');
  lines.push(`- Games: ${report.overview.games}`);
  lines.push(`- Completed games: ${report.overview.completedGames}`);
  lines.push(`- Active games: ${report.overview.activeGames}`);
  lines.push(`- Commands: ${report.overview.commands}`);
  lines.push(`- Events: ${report.overview.events}`);
  lines.push(`- Command success rate: ${formatPercent(report.overview.commandSuccessRate)}`);
  lines.push(`- Command failure rate: ${formatPercent(report.overview.commandFailureRate)}`);
  lines.push(`- Commands with events: ${report.overview.commandsWithEvents}`);
  lines.push(`- Commands without events: ${report.overview.commandsWithoutEvents}`);
  lines.push(`- Event coverage per command: ${formatNumber(report.overview.eventCoveragePerCommand, 2)}`);
  lines.push(`- Server-generated events: ${report.overview.serverEvents}`);
  lines.push('');

  lines.push('## Replay Readiness');
  lines.push(`- Games with sequence problems: ${report.replayReadiness.gamesWithSequenceProblems}`);
  lines.push(`- Commands without events share: ${formatPercent(report.replayReadiness.commandsWithoutEventsShare)}`);
  lines.push(`- Sequence continuity gaps: ${report.integrity.expectedSequenceContinuityGaps}`);
  lines.push(`- Sequence collisions: ${report.integrity.commandSequenceCollisions}`);
  lines.push('');

  lines.push('## Command Mix');
  for (const [type, count] of Object.entries(report.commandAnalysis.byType).slice(0, 10)) {
    lines.push(`- ${commandLabel(type)} (${type}): ${count}`);
  }
  lines.push('');

  lines.push('## Command Failures');
  const failureEntries = Object.entries(report.commandAnalysis.failuresByType);
  if (failureEntries.length === 0) {
    lines.push('- No command failures recorded');
  } else {
    for (const [type, count] of failureEntries.slice(0, 10)) {
      lines.push(`- ${commandLabel(type)} (${type}): ${count}`);
    }
  }
  lines.push('');

  lines.push('## Event Mix');
  for (const [type, count] of Object.entries(report.eventAnalysis.byType).slice(0, 10)) {
    lines.push(`- ${type}: ${count}`);
  }
  lines.push('');

  lines.push('## Strategy Signals');
  lines.push(`- AI players: avg ${formatNumber(report.strategySignals.aiCommandDistribution.averageCommandsPerPlayer, 1)} commands/player, median ${formatNumber(report.strategySignals.aiCommandDistribution.medianCommandsPerPlayer, 1)}, p90 ${formatNumber(report.strategySignals.aiCommandDistribution.p90CommandsPerPlayer, 1)}`);
  lines.push(`- Human players: avg ${formatNumber(report.strategySignals.humanCommandDistribution.averageCommandsPerPlayer, 1)} commands/player, median ${formatNumber(report.strategySignals.humanCommandDistribution.medianCommandsPerPlayer, 1)}, p90 ${formatNumber(report.strategySignals.humanCommandDistribution.p90CommandsPerPlayer, 1)}`);
  lines.push(`- Games with both human and AI players: ${report.datasetNotes.gamesWithMixedHumanAI}`);
  lines.push('');

  lines.push('## High-Signal Games');
  for (const game of report.strategySignals.highestFailureGames.slice(0, 5)) {
    lines.push(`- ${game.name}: ${game.failureCount} failures, ${formatPercent(game.failureRate)} failure rate, ${game.commandCount} commands, ${game.eventCount} events`);
  }
  if (report.strategySignals.highestFailureGames.length === 0) {
    lines.push('- No games with command failures in the selected scope');
  }
  lines.push('');

  lines.push('## Completed Games');
  for (const game of report.strategySignals.completedGames.slice(0, 5)) {
    const topPlayer = game.topPlayer ? `${game.topPlayer.name} (${game.topPlayer.points ?? 'n/a'} pts)` : 'n/a';
    lines.push(`- ${game.name}: cycle ${game.currentCycle ?? 'n/a'}, players ${game.playerCount}, surviving ${game.survivingPlayers}, top player ${topPlayer}`);
  }
  lines.push('');

  if (report.replayReadiness.sequenceIntegrityProblems.length > 0) {
    lines.push('## Sequence Issues');
    for (const issue of report.replayReadiness.sequenceIntegrityProblems.slice(0, 5)) {
      lines.push(`- ${issue.name}: ${issue.missingSequenceCount} missing, ${issue.duplicateSequenceNumbers.length} duplicate sequence numbers`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outputDir, { recursive: true });

  await mongoose.connect(options.mongoUrl);

  try {
    const db = mongoose.connection.db;
    const gameFilter = options.gameId ? { _id: options.gameId } : {};
    const games = await db.collection('games').find(gameFilter).toArray();

    if (games.length === 0) {
      console.log(`No games matched filter ${options.gameId ? options.gameId : '(all games)'}.`);
      return;
    }

    const gameIds = games.map((game) => toObjectIdString(game._id));
    const commandDocs = await db.collection('gamecommandlogs').find({ gameId: { $in: gameIds } }).toArray();
    const eventDocs = await db.collection('gameevents').find({ gameId: { $in: gameIds } }).toArray();

    const report = buildReport(games, commandDocs, eventDocs, options);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scope = options.gameId ? `game-${options.gameId}` : 'all-games';
    const jsonPath = path.join(options.outputDir, `${stamp}-${scope}.json`);
    const markdownPath = path.join(options.outputDir, `${stamp}-${scope}.md`);

    if (options.writeJson) {
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, options.pretty ? 2 : 0));
    }

    if (options.writeMarkdown) {
      fs.writeFileSync(markdownPath, buildMarkdown(report));
    }

    console.log(buildMarkdown(report));
    console.log('');
    if (options.writeJson) {
      console.log(`JSON report written to ${jsonPath}`);
    }
    if (options.writeMarkdown) {
      console.log(`Markdown report written to ${markdownPath}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[analyze-production-history] failed:', error);
  process.exit(1);
});