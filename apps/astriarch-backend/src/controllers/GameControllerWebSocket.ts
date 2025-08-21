import config from 'config';
import { GameModel } from '../models/Game';
import { SessionModel } from '../models/Session';
import { logger } from '../utils/logger';
import * as engine from 'astriarch-engine';

export interface GameSettings {
  maxPlayers?: number;
  gameType?: string;
  isPrivate?: boolean;
}

export interface CreateGameData {
  name: string;
  players: Array<{
    name: string;
    sessionId: string;
    position: number;
  }>;
}

export interface JoinGameData {
  gameId: string;
  sessionId: string;
  playerName: string;
}

export interface StartGameData {
  sessionId: string;
  gameId: string;
  gameOptions?: any;
}

export interface ResumeGameData {
  sessionId: string;
  gameId: string;
}

export interface GameResult {
  success: boolean;
  error?: string;
  errorType?: string;
  game?: any;
  serializableModel?: any;
  playerPosition?: number;
  playerId?: string;
  gameData?: any;
  player?: any;
  // End turn specific properties
  allPlayersFinished?: boolean;
  endOfTurnMessages?: any[];
  destroyedClientPlayers?: any[];
}

/**
 * GameController that matches the old app.js architecture
 * This provides WebSocket-compatible methods for game management
 */
export class GameController {
  
  // ==========================================
  // Game Management Methods (like old app.js)
  // ==========================================

  /**
   * List games available in the lobby
   */
  static async listLobbyGames(options: { sessionId: string }): Promise<any[]> {
    try {
      const games = await GameModel.find({
        status: { $in: ['waiting_for_players', 'in_progress'] }
      })
      .sort({ createdAt: -1 })
      .limit(20);

      // Transform to match old app.js format
      return games.map(game => this.getGameSummaryFromGameDoc(game));
    } catch (error) {
      logger.error('Error listing lobby games:', error);
      throw error;
    }
  }

  /**
   * Create a new game (WebSocket version)
   */
  static async createGame(gameData: CreateGameData): Promise<any> {
    try {

      // Create database record matching old app.js structure
      const game = new GameModel({
        name: gameData.name,
        hostPlayerName: gameData.players[0]?.name || 'Unknown',
        players: gameData.players.map(p => ({
          name: p.name,
          sessionId: p.sessionId,
          position: p.position,
          Id: `player_${p.position}`, // Generate player ID
          isActive: true,
          isAI: false
        })),
        gameOptions: {
          name: gameData.name,
          mainPlayerName: gameData.players[0]?.name || 'Unknown',
          systemsToGenerate: 4, // Default: 4 systems
          planetsPerSystem: 4, // Default: 4 planets per system
          galaxySize: 4, // Default: Large
          distributePlanetsEvenly: true,
          quickStart: false,
          turnTimeLimitSeconds: 0, // Default: No time limit
          opponentOptions: [
            { name: '', type: -1 }, // Player 2: Open
            { name: '', type: -2 }, // Player 3: Closed
            { name: '', type: -2 }  // Player 4: Closed
          ],
          maxPlayers: 4,
          gameType: 'standard',
          isPrivate: false
        },
        gameState: engineGameData.modelData,
        status: 'waiting_for_players',
        createdAt: new Date(),
        lastActivity: new Date()
      });

      await game.save();
      logger.info(`Game "${gameData.name}" created by ${gameData.players[0]?.name}:`, game._id);
      return game;
    } catch (error) {
      logger.error('Error creating game:', error);
      throw error;
    }
  }

  /**
   * Join an existing game (WebSocket version)
   */
  static async joinGame(data: JoinGameData): Promise<GameResult> {
    try {
      const game = await GameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Check if player already in game
      const existingPlayer = game.players?.find(p => p.sessionId === data.sessionId);
      if (existingPlayer) {
        return {
          success: true,
          game,
          playerPosition: existingPlayer.position,
          playerId: existingPlayer.Id
        };
      }

      // Check if game is full
      if (game.players && game.players.length >= (game.gameOptions?.maxPlayers || 4)) {
        return { success: false, error: 'Game is full' };
      }

      // Add player to game
      const playerPosition = game.players ? game.players.length : 0;
      const playerId = `player_${playerPosition}`;
      
      const newPlayer = {
        name: data.playerName,
        sessionId: data.sessionId,
        position: playerPosition,
        Id: playerId,
        isActive: true,
        isAI: false
      };

      if (!game.players) {
        game.players = [];
      }
      game.players.push(newPlayer);
      game.lastActivity = new Date();

      await game.save();
      
      logger.info(`${data.playerName} joined game ${data.gameId} as player ${playerPosition}`);
      return {
        success: true,
        game,
        playerPosition,
        playerId
      };
    } catch (error) {
      logger.error('Error joining game:', error);
      return { success: false, error: 'Failed to join game' };
    }
  }

  /**
   * Start a game (WebSocket version)
   */
  static async startGame(data: StartGameData): Promise<GameResult> {
    try {
      // Find game by gameId from the payload
      const game = await GameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Verify the session is associated with this game
      const player = game.players?.find(p => p.sessionId === data.sessionId);
      if (!player) {
        return { success: false, error: 'Player not found in this game' };
      }

      // Validate game can be started
      if (!game.players || game.players.length < 1) {
        return { success: false, error: 'Not enough players to start game' };
      }

      // Create new engine game with players
      const gameModel = engine.GameModel.constructData(players, gameOptions);

      // Update game status
      game.gameState = engineGameData.modelData;
      game.status = 'in_progress';
      game.lastActivity = new Date();
      await game.save();

      logger.info(`Game ${game._id} started with ${game.players.length} players`);
      return {
        success: true,
        game,
      };
    } catch (error) {
      logger.error('Error starting game:', error);
      return { success: false, error: 'Failed to start game' };
    }
  }

  /**
   * Resume a game (WebSocket version)
   */
  static async resumeGame(data: ResumeGameData): Promise<GameResult> {
    try {
      const game = await GameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      const player = game.players?.find(p => p.sessionId === data.sessionId);
      if (!player) {
        return { success: false, error: 'Player not found in game' };
      }

      return {
        success: true,
        gameData: game.gameState,
        player
      };
    } catch (error) {
      logger.error('Error resuming game:', error);
      return { success: false, error: 'Failed to resume game' };
    }
  }

  // ==========================================
  // Game Action Methods (to be implemented)
  // ==========================================

  static async updateGameOptions(data: { sessionId: string; gameId: string; gameOptions: any; playerName?: string }): Promise<GameResult> {
    try {
      const { sessionId, gameId, gameOptions, playerName } = data;

      // Find the game
      const game = await GameModel.findById(gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Check if the player is the host (first player)
      const player = game.players?.find(p => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: 'Player not found in game' };
      }

      // Only the host (position 0) can change game options
      if (player.position !== 0) {
        return { success: false, error: 'Only the game host can change options' };
      }

      // Update game options
      game.gameOptions = {
        ...game.gameOptions,
        ...gameOptions
      };

      // Update game name if provided
      if (gameOptions.name) {
        game.name = gameOptions.name;
      }

      // Update main player name if provided
      if (playerName && player) {
        player.name = playerName;
        game.hostPlayerName = playerName;
      }

      game.lastActivity = new Date();
      await game.save();

      logger.info(`Game options updated for game ${gameId}`);
      return { success: true, game };

    } catch (error) {
      logger.error('Error updating game options:', error);
      return { success: false, error: 'Failed to update game options' };
    }
  }

  static async changePlayerName(data: any): Promise<GameResult> {
    // TODO: Implement player name change
    logger.warn('changePlayerName not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async endPlayerTurn(sessionId: string, data: any): Promise<GameResult> {
    try {
      const game = await GameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Find player by sessionId
      const player = game.players?.find(p => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: 'Player not found in game' };
      }

      // TODO: Implement end turn logic using engine
      // This would involve:
      // 1. Process player's turn actions
      // 2. Check if all players have ended turn
      // 3. If so, advance game state using engine
      // 4. Return updated game state and any end-of-turn messages

      logger.info(`Player ${player.Id} ended turn for game ${data.gameId}`);
      
      return { 
        success: true, 
        game,
        allPlayersFinished: false,
        endOfTurnMessages: [],
        destroyedClientPlayers: []
      };

    } catch (error) {
      logger.error('EndPlayerTurn error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async sendShips(sessionId: string, data: any): Promise<GameResult> {
    try {
      const game = await GameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Find player by sessionId
      const player = game.players?.find(p => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: 'Player not found in game' };
      }

      // TODO: Implement ship sending using engine
      // This would involve:
      // 1. Validate the ship movement
      // 2. Update game state
      // 3. Save to database

      logger.info(`Player ${player.Id} sending ships in game ${data.gameId}`);
      
      return { success: true, game };

    } catch (error) {
      logger.error('SendShips error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async startUpdatePlanet(data: any, payload: any): Promise<GameResult> {
    // TODO: Implement planet update start
    logger.warn('startUpdatePlanet not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async updatePlanetOptions(data: any, payload: any): Promise<GameResult> {
    // TODO: Implement planet options update
    logger.warn('updatePlanetOptions not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async updatePlanetBuildQueue(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement build queue update
    logger.warn('updatePlanetBuildQueue not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async clearWaypoint(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement waypoint clearing
    logger.warn('clearWaypoint not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async adjustResearchPercent(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement research percent adjustment
    logger.warn('adjustResearchPercent not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async submitResearchItem(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement research submission
    logger.warn('submitResearchItem not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async cancelResearchItem(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement research cancellation
    logger.warn('cancelResearchItem not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async submitTrade(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement trade submission
    logger.warn('submitTrade not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async cancelTrade(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement trade cancellation
    logger.warn('cancelTrade not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  static async exitResign(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement exit/resign
    logger.warn('exitResign not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  // ==========================================
  // Chat and Session Management
  // ==========================================

  static async getChatRoomWithSessions(gameId: string | null): Promise<any> {
    try {
      if (gameId === null) {
        // Lobby chat room - return all sessions not in games
        const sessions = await SessionModel.find({
          $or: [
            { gameId: { $exists: false } },
            { gameId: null }
          ]
        });
        return { sessions };
      } else {
        // Game-specific chat room
        const sessions = await SessionModel.find({ gameId });
        return { sessions };
      }
    } catch (error) {
      logger.error('Error getting chat room with sessions:', error);
      return null;
    }
  }

  static async joinChatRoom(gameId: string | null, session: any): Promise<any> {
    // TODO: Implement chat room joining like old app.js
    logger.warn('joinChatRoom not yet implemented');
    return null;
  }

  static async leaveChatRoom(sessionId: string, broadcast: boolean): Promise<any> {
    // TODO: Implement chat room leaving like old app.js
    logger.warn('leaveChatRoom not yet implemented');
    return null;
  }

  // ==========================================
  // Utility Methods (like old app.js)
  // ==========================================

  static getGameSummaryFromGameDoc(gameDoc: any): any {
    return {
      _id: gameDoc._id,
      name: gameDoc.name,
      status: gameDoc.status,
      playerCount: gameDoc.players ? gameDoc.players.length : 0,
      maxPlayers: gameDoc.gameOptions?.maxPlayers || 4,
      createdAt: gameDoc.createdAt,
      lastActivity: gameDoc.lastActivity
    };
  }

  // ==========================================
  // Session Management
  // ==========================================

  static async touchSession(sessionId: string): Promise<void> {
    try {
      await SessionModel.findOneAndUpdate(
        { sessionId },
        { lastActivity: new Date() },
        { upsert: true }
      );
    } catch (error) {
      logger.error('TouchSession Error:', error);
    }
  }

  static async cleanupExpiredSessions(timeout: number): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - timeout);
      const result = await SessionModel.deleteMany({
        lastActivity: { $lt: cutoffDate }
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} expired sessions`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
    }
  }

  // ==========================================
  // Legacy Cleanup Methods
  // ==========================================

  static async cleanupOldGames(): Promise<void> {
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

  static startGameCleanup(): void {
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
}
