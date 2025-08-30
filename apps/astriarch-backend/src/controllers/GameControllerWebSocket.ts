import config from "config";
import { ServerGameModel, IGame, IPlayer } from "../models/Game";
import { SessionModel } from "../models/Session";
import { logger } from "../utils/logger";
import { persistGame } from "../database/DocumentPersistence";
import * as engine from "astriarch-engine";
import { getPlayerId } from "../utils/player-id-helper";
import { GameModel } from "astriarch-engine";

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
  game?: IGame;
  playerPosition?: number;
  playerId?: string;
  gameData?: any;
  player?: IPlayer;
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
      const games = await ServerGameModel.find({
        status: { $in: ["waiting_for_players", "in_progress"] },
      })
        .sort({ createdAt: -1 })
        .limit(20);

      // Transform to match old app.js format
      return games.map((game) => this.getGameSummaryFromGameDoc(game));
    } catch (error) {
      logger.error("Error listing lobby games:", error);
      throw error;
    }
  }

  /**
   * Create a new game (WebSocket version)
   */
  static async createGame(gameData: CreateGameData): Promise<any> {
    try {
      const gameOptions = {
        systemsToGenerate: 4,
        planetsPerSystem: 4,
        galaxySize: engine.GalaxySizeOption.SMALL,
        distributePlanetsEvenly: true,
        quickStart: false,
        gameSpeed: engine.GameSpeed.NORMAL,
        version: "2.0",
      };
      const playerId = getPlayerId(gameData.players[0].position);
      const gameModel = engine.createGame(playerId, gameData.players[0].name, gameOptions);

      // Create database record matching old app.js structure
      const game = new ServerGameModel({
        name: gameData.name,
        hostPlayerName: gameData.players[0]?.name || "Unknown",
        players: gameData.players.map((p) => ({
          name: p.name,
          sessionId: p.sessionId,
          position: p.position,
          Id: `player_${p.position}`, // Generate player ID
          isActive: true,
          isAI: false,
        })),
        gameOptions: {
          name: gameData.name,
          mainPlayerName: gameData.players[0]?.name || "Unknown",
          systemsToGenerate: 4, // Default: 4 systems
          planetsPerSystem: 4, // Default: 4 planets per system
          galaxySize: 4, // Default: Large
          distributePlanetsEvenly: true,
          quickStart: false,
          turnTimeLimitSeconds: 0, // Default: No time limit
          opponentOptions: [
            { name: "", type: -1 }, // Player 2: Open
            { name: "", type: -2 }, // Player 3: Closed
            { name: "", type: -2 }, // Player 4: Closed
          ],
          maxPlayers: 4,
          gameType: "standard",
          isPrivate: false,
        },
        gameState: gameModel.modelData,
        status: "waiting_for_players",
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      await persistGame(game);
      logger.info(`Game "${gameData.name}" created by ${gameData.players[0]?.name}:`, game._id);
      return game;
    } catch (error) {
      logger.error("Error creating game:", error);
      throw error;
    }
  }

  /**
   * Join an existing game (WebSocket version)
   */
  static async joinGame(data: JoinGameData): Promise<GameResult> {
    try {
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Check if player already in game
      const existingPlayer = game.players?.find((p) => p.sessionId === data.sessionId);
      if (existingPlayer) {
        return {
          success: true,
          game,
          playerPosition: existingPlayer.position,
          playerId: existingPlayer.Id,
        };
      }

      // Check if game is full
      if (game.players && game.players.length >= (game.gameOptions?.maxPlayers || 4)) {
        return { success: false, error: "Game is full" };
      }

      // Add player to game
      const playerPosition = game.players ? game.players.length : 0;
      const playerId = getPlayerId(playerPosition);

      const newPlayer = {
        name: data.playerName,
        sessionId: data.sessionId,
        position: playerPosition,
        Id: playerId,
        isActive: true,
        isAI: false,
      };

      if (!game.players) {
        game.players = [];
      }
      game.players.push(newPlayer);
      game.lastActivity = new Date();

      await persistGame(game);

      logger.info(`${data.playerName} joined game ${data.gameId} as player ${playerPosition}`);
      return {
        success: true,
        game,
        playerPosition,
        playerId,
      };
    } catch (error) {
      logger.error("Error joining game:", error);
      return { success: false, error: "Failed to join game" };
    }
  }

  /**
   * Start a game (WebSocket version)
   */
  static async startGame(data: StartGameData): Promise<GameResult> {
    try {
      // Find game by gameId from the payload
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Verify the session is associated with this game
      const player = game.players?.find((p) => p.sessionId === data.sessionId);
      if (!player) {
        return { success: false, error: "Player not found in this game" };
      }

      // Add computer players based on opponentOptions
      const gameOptions = game.gameOptions;
      const allPlayers = [...(game.players || [])]; // Start with existing human players

      if (gameOptions?.opponentOptions) {
        let computerNumber = 1;

        for (let i = 0; i < gameOptions.opponentOptions.length; i++) {
          const opponentOption = gameOptions.opponentOptions[i];
          const playerType = opponentOption.type;

          if (playerType > 0) {
            // Computer player (1=Easy, 2=Normal, 3=Hard, 4=Expert)
            const computerPlayer = {
              name: `Computer ${computerNumber++}`,
              sessionId: undefined, // Computer players don't have sessions
              position: i + 1, // Positions start from 1 (host is 0)
              Id: getPlayerId(i + 1),
              isActive: true,
              isAI: true,
            };
            allPlayers.push(computerPlayer);
          }
          // playerType === 0 means Human player (should already be in the game)
          // playerType === -1 means Open slot (no player added)
          // playerType === -2 means Closed slot (no player added)
        }
      }

      // Validate we have enough players to start
      if (allPlayers.length < 2) {
        return { success: false, error: "Not enough players to start game" };
      }

      // Create the engine players array
      const enginePlayers = [];
      for (const dbPlayer of allPlayers) {
        if (dbPlayer.isAI) {
          // Create computer player with appropriate AI level
          const aiLevel = gameOptions?.opponentOptions?.[dbPlayer.position - 1]?.type || 2; // Default to Normal
          enginePlayers.push(
            engine.Player.constructPlayer(
              dbPlayer.Id,
              aiLevel, // AI difficulty level maps to PlayerType enum
              dbPlayer.name,
              engine.playerColors[dbPlayer.position] || engine.playerColors[0],
            ),
          );
        } else {
          // Create human player
          enginePlayers.push(
            engine.Player.constructPlayer(
              dbPlayer.Id,
              engine.PlayerType.Human,
              dbPlayer.name,
              engine.playerColors[dbPlayer.position] || engine.playerColors[0],
            ),
          );
        }
      }

      // Create the game model with all players
      const gameModel = engine.GameModel.constructData(enginePlayers, {
        systemsToGenerate: gameOptions?.systemsToGenerate || 4,
        planetsPerSystem: gameOptions?.planetsPerSystem || 4,
        galaxySize: gameOptions?.galaxySize || engine.GalaxySizeOption.SMALL,
        distributePlanetsEvenly: gameOptions?.distributePlanetsEvenly ?? true,
        quickStart: gameOptions?.quickStart ?? false,
        gameSpeed: engine.GameSpeed.NORMAL,
        version: "2.0",
      });

      // Update the game with the complete player list and game state
      game.players = allPlayers;
      game.gameState = gameModel.modelData;
      game.status = "in_progress";
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(
        `Game ${game._id} started with ${allPlayers.length} players (${allPlayers.filter((p) => !p.isAI).length} human, ${allPlayers.filter((p) => p.isAI).length} computer)`,
      );
      return {
        success: true,
        game,
      };
    } catch (error) {
      logger.error("Error starting game:", error);
      return { success: false, error: "Failed to start game" };
    }
  }

  /**
   * Resume a game (WebSocket version)
   */
  static async resumeGame(data: ResumeGameData): Promise<GameResult> {
    try {
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      const player = game.players?.find((p) => p.sessionId === data.sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      return {
        success: true,
        gameData: game.gameState,
        player,
      };
    } catch (error) {
      logger.error("Error resuming game:", error);
      return { success: false, error: "Failed to resume game" };
    }
  }

  // ==========================================
  // Game Action Methods (to be implemented)
  // ==========================================

  static async updateGameOptions(data: {
    sessionId: string;
    gameId: string;
    gameOptions: any;
    playerName?: string;
  }): Promise<GameResult> {
    try {
      const { sessionId, gameId, gameOptions, playerName } = data;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Check if the player is the host (first player)
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Only the host (position 0) can change game options
      if (player.position !== 0) {
        return { success: false, error: "Only the game host can change options" };
      }

      // Update game options
      game.gameOptions = {
        ...game.gameOptions,
        ...gameOptions,
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
      await persistGame(game);

      logger.info(`Game options updated for game ${gameId}`);
      return { success: true, game };
    } catch (error) {
      logger.error("Error updating game options:", error);
      return { success: false, error: "Failed to update game options" };
    }
  }

  static async changePlayerName(data: any): Promise<GameResult> {
    // TODO: Implement player name change
    logger.warn("changePlayerName not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async endPlayerTurn(sessionId: string, data: any): Promise<GameResult> {
    try {
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
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
        destroyedClientPlayers: [],
      };
    } catch (error) {
      logger.error("EndPlayerTurn error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  static async sendShips(sessionId: string, data: any): Promise<GameResult> {
    try {
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // TODO: Implement ship sending using engine
      // This would involve:
      // 1. Validate the ship movement
      // 2. Update game state
      // 3. Save to database

      logger.info(`Player ${player.Id} sending ships in game ${data.gameId}`);

      return { success: true, game };
    } catch (error) {
      logger.error("SendShips error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  static async startUpdatePlanet(data: any, payload: any): Promise<GameResult> {
    // TODO: Implement planet update start
    logger.warn("startUpdatePlanet not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async updatePlanetOptions(sessionId: string, payload: any): Promise<GameResult> {
    try {
      const { gameId, planetId, farmerDiff, minerDiff, builderDiff } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the planet in the game state
      const planet = gameModel.planets?.find((p: any) => p.id === planetId);
      if (!planet) {
        return { success: false, error: "Planet not found" };
      }

      const gamePlayer = gameModel.players?.find((p: any) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Check if this planet exists in the player's owned planets
      const ownsPlanet = GameModel.isPlanetOwnedByPlayer(gamePlayer, planetId);

      if (!ownsPlanet) {
        return { success: false, error: "You do not own this planet" };
      }

      // Update worker assignments using the engine method
      engine.Planet.updatePopulationWorkerTypesByDiff(
        planet,
        gamePlayer,
        farmerDiff || 0,
        minerDiff || 0,
        builderDiff || 0,
      );

      // Save the updated game state
      game.gameState = gameModel;
      await persistGame(game);

      return { success: true, game };
    } catch (error) {
      logger.error("updatePlanetOptions error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred while updating planet options",
      };
    }
  }

  static async updatePlanetBuildQueue(sessionId: string, payload: any): Promise<GameResult> {
    try {
      const { gameId, planetId, action, productionItem } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      // Construct a proper GameModel with grid from the gameState data
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData; // The actual game state

      // Find the planet in the game state
      const planet = gameModel.planets?.find((p: any) => p.id === planetId);
      if (!planet) {
        return { success: false, error: "Planet not found" };
      }

      const gamePlayer = gameModel.players?.find((p: any) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Check if this planet exists in the player's owned planets
      const ownsPlanet = GameModel.isPlanetOwnedByPlayer(gamePlayer, planetId);

      if (!ownsPlanet) {
        return { success: false, error: "You do not own this planet" };
      }

      // Handle different actions
      if (action === "add") {
        // Add item to build queue using engine method
        const planetById = gameModel.planets.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const gamePlayer = gameModel.players?.find((p: any) => p.id === player.Id);
        if (!gamePlayer) {
          return { success: false, error: "Player not found in game state" };
        }
        const clientGameModel = engine.constructClientGameModel(gameModel, player.Id);
        // Use engine method to add to queue and spend resources
        const canBuild = engine.Player.enqueueProductionItemAndSpendResourcesIfPossible(
          clientGameModel,
          gameModelData.grid, // Use the grid from GameModelData
          planet,
          productionItem,
        );

        if (!canBuild) {
          return { success: false, error: "Not enough resources to build item" };
        }

        // Save the updated game state
        game.gameState = gameModel;
        game.lastActivity = new Date();

        // Use data access layer to save with automatic Mixed field handling
        await persistGame(game);

        return {
          success: true,
          game,
          gameData: gameModel,
        };
      } else if (action === "remove") {
        // TODO: Implement remove from queue
        return { success: false, error: "Remove from queue not yet implemented" };
      } else {
        return { success: false, error: "Invalid action" };
      }
    } catch (error) {
      logger.error("UpdatePlanetBuildQueue error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  static async clearWaypoint(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement waypoint clearing
    logger.warn("clearWaypoint not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async adjustResearchPercent(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement research percent adjustment
    logger.warn("adjustResearchPercent not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async submitResearchItem(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement research submission
    logger.warn("submitResearchItem not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async cancelResearchItem(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement research cancellation
    logger.warn("cancelResearchItem not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async submitTrade(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement trade submission
    logger.warn("submitTrade not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async cancelTrade(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement trade cancellation
    logger.warn("cancelTrade not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async exitResign(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement exit/resign
    logger.warn("exitResign not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  // ==========================================
  // Chat and Session Management
  // ==========================================

  static async getChatRoomWithSessions(gameId: string | null): Promise<any> {
    try {
      if (gameId === null) {
        // Lobby chat room - return all sessions not in games
        const sessions = await SessionModel.find({
          $or: [{ gameId: { $exists: false } }, { gameId: null }],
        });
        return { sessions };
      } else {
        // Game-specific chat room
        const sessions = await SessionModel.find({ gameId });
        return { sessions };
      }
    } catch (error) {
      logger.error("Error getting chat room with sessions:", error);
      return null;
    }
  }

  static async joinChatRoom(gameId: string | null, session: any): Promise<any> {
    // TODO: Implement chat room joining like old app.js
    logger.warn("joinChatRoom not yet implemented");
    return null;
  }

  static async leaveChatRoom(sessionId: string, broadcast: boolean): Promise<any> {
    // TODO: Implement chat room leaving like old app.js
    logger.warn("leaveChatRoom not yet implemented");
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
      lastActivity: gameDoc.lastActivity,
    };
  }

  // ==========================================
  // Session Management
  // ==========================================

  static async touchSession(sessionId: string): Promise<void> {
    try {
      await SessionModel.findOneAndUpdate({ sessionId }, { lastActivity: new Date() }, { upsert: true });
    } catch (error) {
      logger.error("TouchSession Error:", error);
    }
  }

  static async cleanupExpiredSessions(timeout: number): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - timeout);
      const result = await SessionModel.deleteMany({
        lastActivity: { $lt: cutoffDate },
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} expired sessions`);
      }
    } catch (error) {
      logger.error("Error cleaning up expired sessions:", error);
    }
  }

  // ==========================================
  // Legacy Cleanup Methods
  // ==========================================

  static async cleanupOldGames(): Promise<void> {
    try {
      const cleanupConfig = config.get("game.cleanup") as any;
      const maxAge = cleanupConfig?.max_age_hours || 24;
      const cutoffDate = new Date(Date.now() - maxAge * 60 * 60 * 1000);

      const result = await ServerGameModel.deleteMany({
        lastActivity: { $lt: cutoffDate },
        status: { $ne: "in_progress" },
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} old games`);
      }
    } catch (error) {
      logger.error("Error during game cleanup:", error);
    }
  }

  static startGameCleanup(): void {
    try {
      const cleanupConfig = config.get("game.cleanup") as any;

      if (cleanupConfig && cleanupConfig.enabled) {
        setInterval(
          async () => {
            await GameController.cleanupOldGames();
          },
          (cleanupConfig.check_interval_seconds || 3600) * 1000,
        );

        logger.info("Game cleanup scheduler started");
      }
    } catch (error) {
      logger.warn("Game cleanup config not found, skipping cleanup scheduler");
    }
  }
}
