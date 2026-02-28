import { Schema, model, Document } from "mongoose";

/**
 * Persistent command log record for event sourcing.
 * Records the raw player command input plus processing result.
 *
 * Shares a monotonic sequenceNumber space with GameEvent within each game,
 * giving a total ordering of commands and events for debugging.
 */
export interface IGameCommandLog extends Document {
  gameId: string;
  commandId: string;
  sequenceNumber: number;
  gameCycle: number;
  timestamp: Date;
  playerId: string;
  commandType: string; // GameCommandType value
  command: any; // Full GameCommand object
  resultSuccess: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

const GameCommandLogSchema = new Schema<IGameCommandLog>(
  {
    gameId: {
      type: String,
      required: true,
    },
    commandId: {
      type: String,
      required: true,
    },
    sequenceNumber: {
      type: Number,
      required: true,
    },
    gameCycle: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    playerId: {
      type: String,
      required: true,
    },
    commandType: {
      type: String,
      required: true,
    },
    command: {
      type: Schema.Types.Mixed,
      required: true,
    },
    resultSuccess: {
      type: Boolean,
      required: true,
    },
    errorCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "gamecommandlogs",
  },
);

// Primary query: replay commands for a game in order
GameCommandLogSchema.index({ gameId: 1, sequenceNumber: 1 }, { unique: true });
// Filter by player within a game
GameCommandLogSchema.index({ gameId: 1, playerId: 1, sequenceNumber: 1 });
// Lookup by commandId
GameCommandLogSchema.index({ commandId: 1 });
// Filter by command type within a game
GameCommandLogSchema.index({ gameId: 1, commandType: 1, sequenceNumber: 1 });

export const GameCommandLog = model<IGameCommandLog>("GameCommandLog", GameCommandLogSchema);
