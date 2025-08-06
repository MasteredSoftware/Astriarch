import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  sessionId: string;
  playerName: string;
  connectionStatus: 'connected' | 'disconnected';
  lastPing: Date;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  playerName: { 
    type: String, 
    required: true 
  },
  connectionStatus: {
    type: String,
    enum: ['connected', 'disconnected'],
    default: 'connected'
  },
  lastPing: { 
    type: Date, 
    default: Date.now 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for efficient queries
SessionSchema.index({ lastPing: 1 });

export const SessionModel = mongoose.model<ISession>('Session', SessionSchema);
