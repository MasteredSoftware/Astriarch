import { 
  startNewGame,
  advanceGameModelTime as engineAdvanceTime
} from 'astriarch-engine';
import { 
  GameState, 
  PlayerAction, 
  GameEvent, 
  RealtimeConnection,
  Game,
  IGameState,
  IPlayerAction,
  IGameEvent
} from '../models';
import { WebSocketServer } from '../websocket/WebSocketServer';
import { logger } from '../utils/logger';

export class RealtimeGameController {
  static readonly MS_PER_CYCLE = 30 * 1000; // 30 seconds per game cycle
  private static activeGames = new Map<string, NodeJS.Timeout>();
  private static gameStates = new Map<string, any>(); // Cache for engine game states

  /**
   * Initialize continuous processing for a game
   */
  static async initializeRealtimeGame(gameId: string): Promise<void> {
    try {
      // Get existing game state or create new one
      const game = await Game.findById(gameId);
      if (!game) {
        throw new Error(`Game not found: ${gameId}`);
      }

      // Initialize engine game state from database
      let engineGameState;
      const latestGameState = await GameState.findOne({ gameId }).sort({ timestamp: -1 });
      
      if (latestGameState) {
        // Use existing game state
        engineGameState = this.convertDatabaseToEngine(latestGameState);
      } else {
        // Create new game state from Game.gameState (migration compatibility)
        engineGameState = game.gameState;
        
        // Save initial state to new schema
        await this.saveGameState(gameId, engineGameState);
      }

      // Cache the engine state
      this.gameStates.set(gameId, engineGameState);

      // Start continuous processing
      this.startContinuousProcessing(gameId);

      logger.info(`Realtime game initialized: ${gameId}`);
    } catch (error) {
      logger.error(`Failed to initialize realtime game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Process a player action through the engine
   */
  static async processPlayerAction(
    gameId: string, 
    playerId: string, 
    actionType: string,
    actionData: any
  ): Promise<{ success: boolean; message?: string; changes?: any }> {
    try {
      // Record the action
      const playerAction = new PlayerAction({
        gameId,
        playerId,
        gameTime: Date.now(), // TODO: Use proper game time
        actionType,
        actionData,
        result: { success: false },
        processed: false
      });

      await playerAction.save();

      // Get current engine state
      let engineGameState = this.gameStates.get(gameId);
      if (!engineGameState) {
        // Load from database if not cached
        const latestState = await GameState.findOne({ gameId }).sort({ timestamp: -1 });
        if (!latestState) {
          throw new Error(`No game state found for game: ${gameId}`);
        }
        engineGameState = this.convertDatabaseToEngine(latestState);
        this.gameStates.set(gameId, engineGameState);
      }

      // Process action through engine
      const result = await this.processActionThroughEngine(
        engineGameState, 
        playerId, 
        actionType, 
        actionData
      );

      // Update action record
      playerAction.result = result;
      playerAction.processed = true;
      playerAction.processingTime = new Date();
      await playerAction.save();

      if (result.success) {
        // Update cached state
        this.gameStates.set(gameId, engineGameState);
        
        // Save state snapshot
        await this.saveGameState(gameId, engineGameState);

        // Create game event
        await this.createGameEvent(gameId, {
          eventType: 'player_action',
          eventData: {
            playerId,
            actionType,
            actionData,
            result: result.changes
          },
          affectedPlayers: await this.getGamePlayers(gameId),
          category: 'player_action'
        });

        // Broadcast state update
        await this.broadcastGameState(gameId, {
          type: 'game_state_update',
          changes: result.changes,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      logger.error(`Failed to process player action in game ${gameId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Broadcast game state updates to all connected players
   */
  static async broadcastGameState(gameId: string, stateUpdate: any): Promise<void> {
    try {
      // Get active connections for this game
      const connections = await RealtimeConnection.find({
        gameId,
        connectionState: 'connected'
      });

      // Broadcast through WebSocket server
      // Note: This requires WebSocketServer to expose a broadcast method
      const wsServer = WebSocketServer.getInstance();
      if (wsServer && wsServer.broadcastToGame) {
        wsServer.broadcastToGame(gameId, stateUpdate);
      }

      // Update connection sync info
      await RealtimeConnection.updateMany(
        { gameId, connectionState: 'connected' },
        { 
          'gameSync.lastSyncTime': new Date(),
          lastActivity: new Date()
        }
      );

    } catch (error) {
      logger.error(`Failed to broadcast game state for game ${gameId}:`, error);
    }
  }

  /**
   * Start continuous processing for a game (replaces turn-based cycles)
   */
  private static startContinuousProcessing(gameId: string): void {
    // Clear any existing interval
    const existingInterval = this.activeGames.get(gameId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start new processing cycle
    const intervalId = setInterval(async () => {
      await this.handleContinuousProcessing(gameId);
    }, this.MS_PER_CYCLE);

    this.activeGames.set(gameId, intervalId);
    logger.info(`Started continuous processing for game: ${gameId}`);
  }

  /**
   * Handle continuous game processing (replaces EndTurns)
   */
  static async handleContinuousProcessing(gameId: string): Promise<void> {
    try {
      let engineGameState = this.gameStates.get(gameId);
      if (!engineGameState) return;

      // Advance game time by one cycle using the actual engine function
      const updatedState = engineAdvanceTime(engineGameState);
      this.gameStates.set(gameId, updatedState);

      // Save state snapshot
      await this.saveGameState(gameId, updatedState);

      // Create system event for time advancement
      await this.createGameEvent(gameId, {
        eventType: 'game_message',
        eventData: {
          message: 'Game time advanced',
          severity: 'info' as const,
          details: { cycleTime: this.MS_PER_CYCLE }
        },
        affectedPlayers: await this.getGamePlayers(gameId),
        category: 'game_flow'
      });

      // Broadcast time update
      await this.broadcastGameState(gameId, {
        type: 'time_update',
        gameTime: Date.now(), // Use current timestamp as game time
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error(`Continuous processing failed for game ${gameId}:`, error);
    }
  }

  /**
   * Stop continuous processing for a game
   */
  static stopContinuousProcessing(gameId: string): void {
    const intervalId = this.activeGames.get(gameId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeGames.delete(gameId);
      this.gameStates.delete(gameId);
      logger.info(`Stopped continuous processing for game: ${gameId}`);
    }
  }

  /**
   * Save current game state to database
   */
  private static async saveGameState(gameId: string, engineGameState: any): Promise<void> {
    const gameState = new GameState({
      gameId,
      gameTime: engineGameState.gameTime || Date.now(),
      planets: engineGameState.planets || {},
      fleets: engineGameState.fleets || {},
      players: engineGameState.players || {},
      gameSettings: engineGameState.gameSettings || {},
      version: '2.0.0'
    });

    await gameState.save();
  }

  /**
   * Create and save a game event
   */
  private static async createGameEvent(gameId: string, eventData: {
    eventType: string;
    eventData: any;
    affectedPlayers: string[];
    category: string;
  }): Promise<void> {
    const gameEvent = new GameEvent({
      gameId,
      gameTime: Date.now(), // TODO: Use proper game time
      ...eventData,
      broadcasted: false,
      persistent: true
    });

    await gameEvent.save();
  }

  /**
   * Get all player IDs for a game
   */
  private static async getGamePlayers(gameId: string): Promise<string[]> {
    const connections = await RealtimeConnection.find({ gameId }).distinct('playerId');
    return connections;
  }

  /**
   * Convert database game state to engine format
   */
  private static convertDatabaseToEngine(dbState: IGameState): any {
    return {
      gameTime: dbState.gameTime,
      planets: dbState.planets,
      fleets: dbState.fleets,
      players: dbState.players,
      gameSettings: dbState.gameSettings
    };
  }

  /**
   * Process action through engine and game action handlers
   */
  private static async processActionThroughEngine(
    engineGameState: any,
    playerId: string,
    actionType: string,
    actionData: any
  ): Promise<{ success: boolean; message?: string; changes?: any }> {
    try {
      // Import GameActionHandler dynamically to avoid circular dependencies
      const { GameActionHandler } = await import('../services/GameActionHandler');
      
      // Process action through specialized handlers
      const result = await GameActionHandler.processAction(
        engineGameState,
        playerId,
        actionType,
        actionData
      );

      // If successful and there are game state updates, apply them
      if (result.success && result.gameStateUpdate) {
        // Merge the updates into the engine game state
        Object.keys(result.gameStateUpdate).forEach(key => {
          if (result.gameStateUpdate[key]) {
            engineGameState[key] = {
              ...engineGameState[key],
              ...result.gameStateUpdate[key]
            };
          }
        });
      }

      return {
        success: result.success,
        message: result.message,
        changes: result.changes
      };

    } catch (error) {
      logger.error('Error in engine action processing:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Engine processing failed'
      };
    }
  }

  /**
   * Get current game state for a game
   */
  static async getCurrentGameState(gameId: string): Promise<any> {
    // Try cache first
    let engineGameState = this.gameStates.get(gameId);
    
    if (!engineGameState) {
      // Load from database
      const latestState = await GameState.findOne({ gameId }).sort({ timestamp: -1 });
      if (latestState) {
        engineGameState = this.convertDatabaseToEngine(latestState);
        this.gameStates.set(gameId, engineGameState);
      }
    }
    
    return engineGameState;
  }

  /**
   * Cleanup resources when server shuts down
   */
  static cleanup(): void {
    for (const [gameId, intervalId] of this.activeGames) {
      clearInterval(intervalId);
      logger.info(`Cleaned up continuous processing for game: ${gameId}`);
    }
    this.activeGames.clear();
    this.gameStates.clear();
  }
}