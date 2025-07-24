import { Schema, model, Document } from 'mongoose';

export interface IPlayerAction extends Document {
  gameId: string;
  playerId: string;
  timestamp: Date;
  gameTime: number; // Game time when action was performed
  actionType: string;
  actionData: {
    planetId?: string;
    fleetId?: string;
    targetPlanetId?: string;
    buildingType?: string;
    quantity?: number;
    coordinates?: {
      x: number;
      y: number;
    };
    [key: string]: any; // Allow flexible action data
  };
  result: {
    success: boolean;
    message?: string;
    changes?: any; // What changed as a result of this action
  };
  processed: boolean;
  processingTime?: Date;
  clientTimestamp?: Date; // When client sent the action
  serverLatency?: number; // Time between client and server processing
}

const PlayerActionSchema = new Schema<IPlayerAction>({
  gameId: {
    type: String,
    required: true,
    index: true
  },
  playerId: {
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
    required: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'build_structure',
      'send_fleet',
      'attack_planet',
      'colonize_planet',
      'research_upgrade',
      'demolish_structure',
      'fleet_orders',
      'planet_management',
      'diplomacy_action',
      'trade_action'
    ]
  },
  actionData: {
    type: Schema.Types.Mixed,
    required: true
  },
  result: {
    success: {
      type: Boolean,
      required: true,
      default: false
    },
    message: String,
    changes: Schema.Types.Mixed
  },
  processed: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  processingTime: Date,
  clientTimestamp: Date,
  serverLatency: Number
}, {
  timestamps: true,
  collection: 'playeractions'
});

// Critical indexes for realtime performance
PlayerActionSchema.index({ gameId: 1, timestamp: -1 });
PlayerActionSchema.index({ gameId: 1, playerId: 1, timestamp: -1 });
PlayerActionSchema.index({ gameId: 1, processed: 1 });
PlayerActionSchema.index({ gameId: 1, actionType: 1, timestamp: -1 });
PlayerActionSchema.index({ gameTime: 1 });

export const PlayerAction = model<IPlayerAction>('PlayerAction', PlayerActionSchema);