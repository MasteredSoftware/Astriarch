import config from 'config';
import { GameModel } from '../models/Game';
import { SessionModel } from '../models/Session';
import { logger } from '../utils/logger';
import { startNewGame, GameModelData, Player, PlayerData } from 'astriarch-engine';
import { Planet } from 'astriarch-engine/src/engine/planet';

export interface GameSettings {
  maxPlayers?: number;
  gameType?: string;
  isPrivate?: boolean;
}

export class GameController {
  /**
   * Create a new game
   */
  static async createGame(playerName: string, gameSettings: GameSettings = {}) {
    try {
      // Create engine game model using startNewGame function
      const { gameModel: engineGameData, clientGameModel } = startNewGame();

      // Create database record
      const game = new GameModel({
        hostPlayerName: playerName,
        maxPlayers: gameSettings.maxPlayers || 4,
        gameType: gameSettings.gameType || 'standard',
        isPrivate: gameSettings.isPrivate || false,
        gameState: engineGameData.modelData,
        status: 'waiting_for_players',
        createdAt: new Date(),
        lastActivity: new Date()
      });

      await game.save();
      
      logger.info(`Game created by ${playerName}:`, game._id);
      return game;
    } catch (error) {
      logger.error('Error creating game:', error);
      throw error;
    }
  }

  /**
   * Join an existing game
   */
  static async joinGame(gameId: string, playerName: string) {
    try {
      const game = await GameModel.findById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      // For now, we'll just add the player name to a list
      // TODO: Implement proper player management with the engine
      
      // Update database
      game.lastActivity = new Date();
      
      // TODO: Check player count and update status appropriately
      
      await game.save();
      
      logger.info(`${playerName} joined game ${gameId}`);
      return game;
    } catch (error) {
      logger.error('Error joining game:', error);
      throw error;
    }
  }

  /**
   * Get game by ID
   */
  static async getGame(gameId: string) {
    try {
      return await GameModel.findById(gameId);
    } catch (error) {
      logger.error('Error getting game:', error);
      throw error;
    }
  }

  /**
   * Get active games
   */
  static async getActiveGames() {
    try {
      return await GameModel.find({
        status: { $in: ['waiting_for_players', 'in_progress'] }
      }).sort({ createdAt: -1 }).limit(20);
    } catch (error) {
      logger.error('Error getting active games:', error);
      throw error;
    }
  }

  /**
   * Enqueue production item
   */
  static async enqueueProductionItem(
    gameId: string,
    planetId: string,
    productionItem: any, // TODO: Define proper type when engine integration is complete
    sessionId: string
  ) {
    try {
      const game = await GameModel.findById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      const session = await SessionModel.findOne({ sessionId, gameId });
      if (!session) {
        throw new Error('Session not found');
      }

      // TODO: Implement proper production item enqueuing with the engine
      // For now, we'll just log the action
      logger.info(`${session.playerName} enqueued production item on planet ${planetId}`);

      // Update last activity
      game.lastActivity = new Date();
      await game.save();

      return {
        success: true,
        message: 'Production item enqueued successfully'
      };
    } catch (error) {
      logger.error('Error enqueuing production item:', error);
      throw error;
    }
  }

  /**
   * Start automatic cleanup of old games
   */
  static startGameCleanup() {
    try {
      const cleanupConfig = config.get('game.cleanup') as any;
      
      if (cleanupConfig && cleanupConfig.enabled) {
        setInterval(async () => {
          await GameController.cleanupOldGames();
        }, (cleanupConfig.check_interval_seconds || 3600) * 1000);
        
        logger.info('Game cleanup scheduler started');
      }
    } catch (error) {
      logger.warn('Game cleanup config not found, skipping cleanup scheduler');
    }
  }

  /**
   * Clean up old inactive games
   */
  static async cleanupOldGames() {
    try {
      const cleanupConfig = config.get('game.cleanup') as any;
      const maxAge = cleanupConfig?.max_age_hours || 24;
      const cutoffDate = new Date(Date.now() - maxAge * 60 * 60 * 1000);

      const result = await GameModel.deleteMany({
        lastActivity: { $lt: cutoffDate },
        status: { $ne: 'in_progress' }
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} old games`);
      }
    } catch (error) {
      logger.error('Error during game cleanup:', error);
    }
  }

  /**
   * Get list of available games
   */
  static async getAvailableGames() {
    try {
      const games = await GameModel.find({
        status: { $in: ['waiting_for_players', 'in_progress'] }
      })
      .sort({ createdAt: -1 })
      .limit(50);

      return games;
    } catch (error) {
      logger.error('Error getting available games:', error);
      throw error;
    }
  }
}
