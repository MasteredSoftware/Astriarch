import mongoose, { Schema, Document } from 'mongoose';

export interface IGame extends Document {
  hostPlayerName: string;
  maxPlayers: number;
  gameType: string;
  isPrivate: boolean;
  gameState: object;
  status: 'waiting_for_players' | 'in_progress' | 'completed';
  createdAt: Date;
  lastActivity: Date;
}

const GameSchema = new Schema<IGame>({
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

export const GameModel = mongoose.model<IGame>('Game', GameSchema);
