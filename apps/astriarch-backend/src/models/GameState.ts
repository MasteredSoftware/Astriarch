import { Schema, model, Document } from "mongoose";

export interface IGameState extends Document {
  gameId: string;
  timestamp: Date;
  gameTime: number; // Game time in milliseconds since start
  planets: {
    [planetId: string]: {
      playerId: string | null;
      population: number;
      buildings: {
        farms: number;
        mines: number;
        factories: number;
        spacePlatforms: number;
      };
      resources: {
        food: number;
        ore: number;
        iridium: number;
      };
      buildQueue: Array<{
        type: string;
        turnsRemaining: number;
        startTime: Date;
      }>;
      workingData?: any; // Temporary for migration compatibility
    };
  };
  fleets: {
    [fleetId: string]: {
      playerId: string;
      ships: {
        scouts: number;
        destroyers: number;
        cruisers: number;
        battleships: number;
      };
      position: {
        x: number;
        y: number;
      };
      destination?: {
        planetId: string;
        arrivalTime: Date;
      };
      orders: string;
    };
  };
  players: {
    [playerId: string]: {
      name: string;
      isAI: boolean;
      research: {
        attack: number;
        defense: number;
        propulsion: number;
      };
      resources: {
        credits: number;
      };
      isActive: boolean;
      lastActionTime?: Date;
    };
  };
  gameSettings: {
    gameSpeed: number;
    maxPlayers: number;
    galaxySize: string;
    aiDifficulty: string;
  };
  version: string; // Schema version for migration tracking
}

const GameStateSchema = new Schema<IGameState>(
  {
    gameId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    gameTime: {
      type: Number,
      required: true,
      default: 0,
    },
    planets: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    fleets: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    players: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    gameSettings: {
      type: Schema.Types.Mixed,
      required: true,
    },
    version: {
      type: String,
      required: true,
      default: "2.0.0",
    },
  },
  {
    timestamps: true,
    collection: "gamestates",
  },
);

// Indexes for realtime performance
GameStateSchema.index({ gameId: 1, timestamp: -1 });
GameStateSchema.index({ gameId: 1, gameTime: -1 });
GameStateSchema.index({ "players.lastActionTime": -1 });

export const GameState = model<IGameState>("GameState", GameStateSchema);
