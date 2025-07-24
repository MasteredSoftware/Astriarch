import { Schema, model, Document } from 'mongoose';

export interface IRealtimeConnection extends Document {
  gameId: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  connectionState: 'connected' | 'disconnected' | 'reconnecting' | 'timeout';
  websocketId?: string; // Internal WebSocket connection ID
  connectedAt: Date;
  lastActivity: Date;
  disconnectedAt?: Date;
  reconnectAttempts: number;
  clientInfo: {
    userAgent?: string;
    ipAddress?: string;
    version?: string;
  };
  gameSync: {
    lastSyncTime?: Date;
    syncVersion?: string;
    pendingActions?: number; // Number of unprocessed actions
  };
  performance: {
    latency?: number; // Average roundtrip latency in ms
    packetsLost?: number;
    reconnects?: number;
  };
}

const RealtimeConnectionSchema = new Schema<IRealtimeConnection>({
  gameId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  playerId: {
    type: String,
    required: true,
    index: true
  },
  playerName: {
    type: String,
    required: true
  },
  connectionState: {
    type: String,
    required: true,
    enum: ['connected', 'disconnected', 'reconnecting', 'timeout'],
    default: 'connected',
    index: true
  },
  websocketId: {
    type: String,
    index: true
  },
  connectedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  disconnectedAt: Date,
  reconnectAttempts: {
    type: Number,
    default: 0
  },
  clientInfo: {
    userAgent: String,
    ipAddress: String,
    version: String
  },
  gameSync: {
    lastSyncTime: Date,
    syncVersion: String,
    pendingActions: {
      type: Number,
      default: 0
    }
  },
  performance: {
    latency: Number,
    packetsLost: {
      type: Number,
      default: 0
    },
    reconnects: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  collection: 'realtimeconnections'
});

// Indexes for connection management and monitoring
RealtimeConnectionSchema.index({ gameId: 1, connectionState: 1 });
RealtimeConnectionSchema.index({ gameId: 1, playerId: 1 });
RealtimeConnectionSchema.index({ sessionId: 1 }, { unique: true });
RealtimeConnectionSchema.index({ lastActivity: 1 }); // For cleanup of stale connections
RealtimeConnectionSchema.index({ websocketId: 1 });

// TTL index for automatic cleanup of old disconnected connections (24 hours)
RealtimeConnectionSchema.index(
  { disconnectedAt: 1 }, 
  { 
    expireAfterSeconds: 24 * 60 * 60,
    partialFilterExpression: { connectionState: 'disconnected' }
  }
);

export const RealtimeConnection = model<IRealtimeConnection>('RealtimeConnection', RealtimeConnectionSchema);