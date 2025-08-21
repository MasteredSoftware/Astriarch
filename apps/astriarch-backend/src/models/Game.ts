import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer {
  name: string;
  sessionId: string;
  position: number;
  Id: string;
  isActive: boolean;
  isAI: boolean;
}

export interface IGameOptions {
  name?: string;
  mainPlayerName?: string;
  systemsToGenerate?: number; // Number of systems (2-4 players)
  planetsPerSystem?: number; // 4-8 planets per system
  galaxySize?: number; // 1: Tiny, 2: Small, 3: Medium, 4: Large
  distributePlanetsEvenly?: boolean;
  quickStart?: boolean;
  turnTimeLimitSeconds?: number; // 0: None, 30, 60, 120, 180, 300
  opponentOptions?: Array<{
    name: string;
    type: number; // -2: Closed, -1: Open, 0: Human, 1: Easy Computer, 2: Normal Computer, 3: Hard Computer, 4: Expert Computer
  }>;
  maxPlayers?: number;
  gameType?: string;
  isPrivate?: boolean;
}

export interface IGame extends Document {
  name: string; // Game name (for lobby display)
  hostPlayerName: string;
  maxPlayers: number;
  gameType: string;
  isPrivate: boolean;
  gameState: object;
  status: 'waiting_for_players' | 'in_progress' | 'completed';
  players: IPlayer[]; // Array of players in the game
  gameOptions: IGameOptions; // Game configuration options
  createdAt: Date;
  lastActivity: Date;
}

const PlayerSchema = new Schema<IPlayer>({
  name: { type: String, required: true },
  sessionId: { type: String, required: true },
  position: { type: Number, required: true },
  Id: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isAI: { type: Boolean, default: false }
});

const GameOptionsSchema = new Schema<IGameOptions>({
  maxPlayers: { type: Number, default: 4 },
  gameType: { type: String, default: 'standard' },
  isPrivate: { type: Boolean, default: false }
});

const GameSchema = new Schema<IGame>({
  name: { 
    type: String 
  },
  hostPlayerName: { 
    type: String, 
    required: true 
  },
  maxPlayers: { 
    type: Number, 
    required: true, 
    default: 4 
  },
  gameType: { 
    type: String, 
    required: true, 
    default: 'standard' 
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  gameState: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  status: {
    type: String,
    enum: ['waiting_for_players', 'in_progress', 'completed'],
    default: 'waiting_for_players'
  },
  players: {
    type: [PlayerSchema],
    default: []
  },
  gameOptions: {
    type: GameOptionsSchema,
    default: () => ({})
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastActivity: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for efficient queries
GameSchema.index({ status: 1, createdAt: -1 });
GameSchema.index({ lastActivity: 1 });

export const ServerGameModel = mongoose.model<IGame>('Game', GameSchema);
