import { Schema, model, Document } from "mongoose";

/**
 * Persistent domain event record for event sourcing.
 * Wraps the engine's ClientEvent with metadata for ordering, correlation, and replay.
 *
 * Shares a monotonic sequenceNumber space with GameCommandLog within each game,
 * giving a total ordering of commands and events for debugging.
 */
export interface IGameEvent extends Document {
  gameId: string;
  eventId: string;
  sequenceNumber: number;
  gameCycle: number;
  timestamp: Date;
  sourcePlayerId: string;
  sourceCommandId: string | null;
  eventType: string; // ClientEventType value
  affectedPlayerIds: string[];
  payload: any; // Full ClientEvent object
}

const GameEventSchema = new Schema<IGameEvent>(
  {
    gameId: {
      type: String,
      required: true,
    },
    eventId: {
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
    sourcePlayerId: {
      type: String,
      required: true,
    },
    sourceCommandId: {
      type: String,
      default: null,
    },
    eventType: {
      type: String,
      required: true,
    },
    affectedPlayerIds: [
      {
        type: String,
      },
    ],
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "gameevents",
  },
);

// Primary query: replay events for a game in order
GameEventSchema.index({ gameId: 1, sequenceNumber: 1 }, { unique: true });
// Debug: filter by event type within a game
GameEventSchema.index({ gameId: 1, eventType: 1, sequenceNumber: 1 });
// Player-scoped replay (observer viewing one player's perspective)
GameEventSchema.index({ gameId: 1, sourcePlayerId: 1, sequenceNumber: 1 });
// Lookup by eventId
GameEventSchema.index({ eventId: 1 }, { unique: true });
// Player-affected query (what events did a specific player see?)
GameEventSchema.index({ gameId: 1, affectedPlayerIds: 1, sequenceNumber: 1 });

export const GameEvent = model<IGameEvent>("GameEvent", GameEventSchema);
