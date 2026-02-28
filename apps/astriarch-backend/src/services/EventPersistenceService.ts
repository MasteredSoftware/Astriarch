import { v4 as uuidv4 } from "uuid";
import { GameEvent } from "../models/GameEvent";
import { GameCommandLog } from "../models/GameCommandLog";
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
 */
export class EventPersistenceService {
  /**
   * Next sequence number per game. Loaded lazily from MongoDB on first access.
   * Key: gameId, Value: next sequence number to assign.
   */
  private sequenceCounters: Map<string, number> = new Map();

  /**
   * Get the next sequence number for a game, loading from MongoDB if needed.
   */
  private async getNextSequence(gameId: string): Promise<number> {
    if (!this.sequenceCounters.has(gameId)) {
      // Find the highest sequence number across both collections
      const [latestEvent, latestCommand] = await Promise.all([
        GameEvent.findOne({ gameId }).sort({ sequenceNumber: -1 }).select("sequenceNumber").lean(),
        GameCommandLog.findOne({ gameId }).sort({ sequenceNumber: -1 }).select("sequenceNumber").lean(),
      ]);

      const maxEventSeq = latestEvent?.sequenceNumber ?? -1;
      const maxCommandSeq = latestCommand?.sequenceNumber ?? -1;
      const nextSeq = Math.max(maxEventSeq, maxCommandSeq) + 1;

      this.sequenceCounters.set(gameId, nextSeq);
    }

    const seq = this.sequenceCounters.get(gameId)!;
    this.sequenceCounters.set(gameId, seq + 1);
    return seq;
  }

  /**
   * Persist a command and its resulting events to MongoDB.
   *
   * This is the primary entry point — call it after CommandProcessor.processCommand
   * returns. It persists the command first, then its events, all with sequential
   * sequence numbers.
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

      // Persist the command
      const commandSeq = await this.getNextSequence(gameId);
      const persistedCommand: PersistedCommand = {
        commandId: command.commandId,
        gameId,
        sequenceNumber: commandSeq,
        gameCycle,
        timestamp: now,
        playerId: command.playerId,
        commandType: command.type,
        command,
        resultSuccess: result.success,
        errorCode: result.error?.code ?? null,
        errorMessage: result.error?.message ?? null,
      };

      await GameCommandLog.create({
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

      // Persist the resulting events (if command succeeded and produced events)
      if (result.success && result.events.length > 0) {
        await this.persistEvents(gameId, result.events, gameCycle, command.playerId, command.commandId);
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
      const domainEvents: DomainEvent[] = [];

      for (const event of events) {
        const seq = await this.getNextSequence(gameId);
        domainEvents.push({
          eventId: uuidv4(),
          gameId,
          sequenceNumber: seq,
          gameCycle,
          timestamp: now,
          sourcePlayerId,
          sourceCommandId: event.sourceCommandId ?? sourceCommandId,
          eventType: event.type,
          affectedPlayerIds: event.affectedPlayerIds,
          payload: event,
        });
      }

      // Bulk insert all events at once
      await GameEvent.insertMany(
        domainEvents.map((de) => ({
          gameId: de.gameId,
          eventId: de.eventId,
          sequenceNumber: de.sequenceNumber,
          gameCycle: de.gameCycle,
          timestamp: new Date(de.timestamp),
          sourcePlayerId: de.sourcePlayerId,
          sourceCommandId: de.sourceCommandId,
          eventType: de.eventType,
          affectedPlayerIds: de.affectedPlayerIds,
          payload: de.payload,
        })),
        { ordered: true },
      );
    } catch (error) {
      // Fire-and-forget: log but don't throw
      logger.error(`Failed to persist ${events.length} events for game ${gameId}:`, error);
    }
  }

  /**
   * Reset the cached sequence counter for a game.
   * Call this when a game ends or is deleted to free memory.
   */
  resetSequenceCounter(gameId: string): void {
    this.sequenceCounters.delete(gameId);
  }

  /**
   * Clear all cached sequence counters.
   */
  resetAllSequenceCounters(): void {
    this.sequenceCounters.clear();
  }
}

/**
 * Singleton instance shared across the backend.
 */
export const eventPersistenceService = new EventPersistenceService();
