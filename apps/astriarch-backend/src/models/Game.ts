import { ServerGameOptions } from "astriarch-engine";
import mongoose, { Schema, Document } from "mongoose";

export interface IPlayer {
  name: string;
  sessionId?: string; // Optional for computer players
  position: number;
  Id: string;
  isActive: boolean;
  isAI: boolean;
  destroyed: boolean;
}

export interface IGame extends Document {
  name: string; // Game name (for lobby display)
  hostPlayerName: string;
  maxPlayers: number;
  gameType: string;
  isPrivate: boolean;
  gameState: object;
  status: "waiting_for_players" | "in_progress" | "completed";
  players: IPlayer[]; // Array of players in the game
  gameOptions: ServerGameOptions; // Game configuration options
  createdAt: Date;
  lastActivity: Date;
}

const PlayerSchema = new Schema<IPlayer>({
  name: { type: String, required: true },
  sessionId: { type: String, required: false }, // Not required for computer players
  position: { type: Number, required: true },
  Id: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isAI: { type: Boolean, default: false },
  destroyed: { type: Boolean, default: false },
});

const GameSchema = new Schema<IGame>({
  nonce: {
    type: Schema.Types.ObjectId,
    required: false, // Will be generated on first save for backward compatibility
  },
  name: {
    type: String,
  },
  hostPlayerName: {
    type: String,
    required: true,
  },
  maxPlayers: {
    type: Number,
    required: true,
    default: 4,
  },
  gameType: {
    type: String,
    required: true,
    default: "standard",
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  gameState: {
    type: Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ["waiting_for_players", "in_progress", "completed"],
    default: "waiting_for_players",
  },
  players: {
    type: [PlayerSchema],
    default: [],
  },
  gameOptions: {
    type: Schema.Types.Mixed,
    default: () => ({}),
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
});

// Configure schema to preserve empty objects
GameSchema.set("minimize", false);

// Index for efficient queries
GameSchema.index({ status: 1, createdAt: -1 });
GameSchema.index({ lastActivity: 1 });

export const ServerGameModel = mongoose.model<IGame>("Game", GameSchema);
