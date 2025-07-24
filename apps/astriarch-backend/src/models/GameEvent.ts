import { Schema, model, Document } from 'mongoose';

export interface IGameEvent extends Document {
  gameId: string;
  timestamp: Date;
  gameTime: number; // Game time when event occurred
  eventType: string;
  eventData: {
    playerId?: string;
    planetId?: string;
    fleetId?: string;
    message?: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    details?: any;
  };
  affectedPlayers: string[]; // Which players should see this event
  broadcasted: boolean; // Whether this event has been sent to clients
  broadcastTime?: Date;
  persistent: boolean; // Whether to store in player's event history
  category: string; // For filtering and organization
}

const GameEventSchema = new Schema<IGameEvent>({
  gameId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  gameTime: {
    type: Number,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'game_start',
      'game_end',
      'player_join',
      'player_leave',
      'planet_colonized',
      'planet_attacked',
      'planet_conquered',
      'fleet_arrived',
      'fleet_destroyed',
      'building_completed',
      'research_completed',
      'battle_result',
      'diplomacy_change',
      'trade_completed',
      'game_message',
      'system_notification',
      'error_occurred'
    ]
  },
  eventData: {
    type: Schema.Types.Mixed,
    required: true
  },
  affectedPlayers: [{
    type: String,
    required: true
  }],
  broadcasted: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  broadcastTime: Date,
  persistent: {
    type: Boolean,
    required: true,
    default: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'game_flow',
      'player_action',
      'battle',
      'economy',
      'diplomacy',
      'system',
      'error'
    ],
    index: true
  }
}, {
  timestamps: true,
  collection: 'gameevents'
});

// Critical indexes for realtime event processing
GameEventSchema.index({ gameId: 1, timestamp: -1 });
GameEventSchema.index({ gameId: 1, eventType: 1, timestamp: -1 });
GameEventSchema.index({ gameId: 1, broadcasted: 1 });
GameEventSchema.index({ gameId: 1, affectedPlayers: 1, timestamp: -1 });
GameEventSchema.index({ gameId: 1, category: 1, timestamp: -1 });
GameEventSchema.index({ gameTime: 1 });

export const GameEvent = model<IGameEvent>('GameEvent', GameEventSchema);