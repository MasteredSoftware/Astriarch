import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  gameId: mongoose.Types.ObjectId;
  playerName: string;
  message: string;
  timestamp: Date;
  messageType: 'public' | 'team' | 'system';
}

const ChatMessageSchema = new Schema<IChatMessage>({
  gameId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Game', 
    required: true 
  },
  playerName: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true, 
    maxlength: 500 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  messageType: {
    type: String,
    enum: ['public', 'team', 'system'],
    default: 'public'
  }
});

// Index for efficient chat retrieval
ChatMessageSchema.index({ gameId: 1, timestamp: -1 });

export const ChatMessageModel = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
