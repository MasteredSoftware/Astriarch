import { v4 as uuidv4 } from "uuid";
import { GameEvent } from "../models/GameEvent";
import { GameCommandLog } from "../models/GameCommandLog";
import { SequenceCounter } from "../models/SequenceCounter";
import { logger } from "../utils/logger";
import type { ClientEvent, GameCommand, CommandResult, DomainEvent, PersistedCommand } from "astriarch-engine";

/**
 * EventPersistenceService
 *
 * Persists commands and events to MongoDB for debugging, replay, and observability.
 * All writes are fire-and-forget — persistence failures are logged but never
 * block or break the game loop.
 *
 * Commands and events share a monotonic sequence number per game, giving a
 * total ordering for debugging (e.g., "command 42 produced events 43, 44, 45").
 *
 * Sequence numbers are allocated atomically via MongoDB's findOneAndUpdate + $inc
 * on a dedicated counters collection — no in-memory state, no race conditions,
 * works across multiple server nodes.
 */
export class EventPersistenceService {
  /**
   * Atomically reserve a contiguous block of sequence numbers for a game.
   * Uses MongoDB findOneAndUpdate with $inc — a single atomic operation that
   * returns the value *before* incrementing (returnDocument: 'before').
   *
   * @param gameId - The game ID
   * @param count - How many sequence numbers to reserve (default: 1)
   * @returns The first sequence number in the reserved block
   */
  private async reserveSequenceBlock(gameId: string, count: number = 1): Promise<number> {
    const counterKey = `game:${gameId}`;
    const result = await SequenceCounter.findOneAndUpdate(
      { _id: counterKey },
      { $inc: { seq: count } },
      { upsert: true, returnDocument: "before" },
    );
    // On first upsert, result is null — counter starts at 0
    return result?.seq ?? 0;
  }

  /**
   * Persist a command and its resulting events to MongoDB.
   *
   * This is the primary entry point — call it after CommandProcessor.processCommand
   * returns. It reserves a contiguous block of sequence numbers (1 for the command
   * + N for events) in a single atomic operation, then writes them all.
   *
   * @param gameId - The game ID
   * @param command - The original GameCommand
   * @param result - The CommandResult from processing
   * @param gameCycle - Current game cycle when command was processed
   */
  async persistCommandAndEvents(
    gameId: string,
    command: GameCommand,
    result: CommandResult,
    gameCycle: number,
  ): Promise<void> {
    try {
      const now = Date.now();
      const eventCount = result.success ? result.events.length : 0;

      // Reserve 1 (command) + N (events) sequence numbers atomically
      const firstSeq = await this.reserveSequenceBlock(gameId, 1 + eventCount);

      // Persist the command
      const persistedCommand: PersistedCommand = {
        commandId: command.commandId,
        gameId,
        sequenceNumber: firstSeq,
        gameCycle,
        timestamp: now,
        playerId: command.playerId,
        commandType: command.type,
        command,
        resultSuccess: result.success,
        errorCode: result.error?.code ?? null,
        errorMessage: result.error?.message ?? null,
      };

      const commandPromise = GameCommandLog.create({
        gameId: persistedCommand.gameId,
        commandId: persistedCommand.commandId,
        sequenceNumber: persistedCommand.sequenceNumber,
        gameCycle: persistedCommand.gameCycle,
        timestamp: new Date(persistedCommand.timestamp),
        playerId: persistedCommand.playerId,
        commandType: persistedCommand.commandType,
        command: persistedCommand.command,
        resultSuccess: persistedCommand.resultSuccess,
        errorCode: persistedCommand.errorCode,
        errorMessage: persistedCommand.errorMessage,
      });

      // Persist resulting events with pre-assigned sequence numbers
      if (eventCount > 0) {
        const eventDocs = result.events.map((event, i) => ({
          gameId,
          eventId: uuidv4(),
          sequenceNumber: firstSeq + 1 + i,
          gameCycle,
          timestamp: new Date(now),
          sourcePlayerId: command.playerId,
          sourceCommandId: event.sourceCommandId ?? command.commandId,
          eventType: event.type,
          affectedPlayerIds: event.affectedPlayerIds,
          payload: event,
        }));

        // Write command and events in parallel
        await Promise.all([commandPromise, GameEvent.insertMany(eventDocs, { ordered: true })]);
      } else {
        await commandPromise;
      }
    } catch (error) {
      // Fire-and-forget: log but don't throw
      logger.error(`Failed to persist command ${command.commandId} for game ${gameId}:`, error);
    }
  }

  /**
   * Persist events that were generated outside of a command (e.g., time-based
   * events from advanceGameModelTime: conflicts, trade execution, AI actions).
   *
   * @param gameId - The game ID
   * @param events - Array of ClientEvents to persist
   * @param gameCycle - Current game cycle when events were generated
   * @param sourcePlayerId - 'server' for time-based events
   * @param sourceCommandId - null for server-generated events
   */
  async persistEvents(
    gameId: string,
    events: ClientEvent[],
    gameCycle: number,
    sourcePlayerId: string,
    sourceCommandId: string | null = null,
  ): Promise<void> {
    if (events.length === 0) return;

    try {
      const now = Date.now();

      // Reserve all sequence numbers in one atomic operation
      const firstSeq = await this.reserveSequenceBlock(gameId, events.length);

      const eventDocs = events.map((event, i) => ({
        gameId,
        eventId: uuidv4(),
        sequenceNumber: firstSeq + i,
        gameCycle,
        timestamp: new Date(now),
        sourcePlayerId,
        sourceCommandId: event.sourceCommandId ?? sourceCommandId,
        eventType: event.type,
        affectedPlayerIds: event.affectedPlayerIds,
        payload: event,
      }));

      await GameEvent.insertMany(eventDocs, { ordered: true });
    } catch (error) {
      // Fire-and-forget: log but don't throw
      logger.error(`Failed to persist ${events.length} events for game ${gameId}:`, error);
    }
  }
}

/**
 * Singleton instance shared across the backend.
 */
export const eventPersistenceService = new EventPersistenceService();
