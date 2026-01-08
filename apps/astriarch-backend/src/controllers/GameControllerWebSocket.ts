import config from "config";
import { ServerGameModel, IGame, IPlayer } from "../models/Game";
import { SessionModel } from "../models/Session";
import { logger } from "../utils/logger";
import { persistGame, saveGameWithConcurrencyProtection } from "../database/DocumentPersistence";
import * as engine from "astriarch-engine";
import { getPlayerId } from "../utils/player-id-helper";
import {
  GameModel,
  Fleet,
  StarShipType,
  ResearchType,
  TradingCenter,
  TradeType,
  TradingCenterResourceType,
  PlayerType,
  GameCommand,
  GameCommandType,
  ClientEvent,
  ClientEventType,
  CommandProcessor,
  calculateRollingEventChecksum,
  constructClientGameModel,
  advanceGameModelTime,
  type PlayerData,
  type GameEndConditions,
} from "astriarch-engine";

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
  gameOptions?: any;
}

// Helper function to convert opponent option type to PlayerType
function mapOpponentTypeToPlayerType(opponentType: number): PlayerType {
  switch (opponentType) {
    case 1: // EASY_COMPUTER
      return PlayerType.Computer_Easy;
    case 2: // NORMAL_COMPUTER
      return PlayerType.Computer_Normal;
    case 3: // HARD_COMPUTER
      return PlayerType.Computer_Hard;
    case 4: // EXPERT_COMPUTER
      return PlayerType.Computer_Expert;
    default:
      return PlayerType.Computer_Normal; // Default fallback
  }
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

export interface DestroyedPlayer {
  id: string;
  type: engine.PlayerType;
  name: string;
  destroyed: boolean;
}

export interface GameResult {
  success: boolean;
  error?: string;
  errorType?: string;
  game?: IGame;
  playerPosition?: number;
  playerId?: string;
  gameData?: engine.ModelData;
  player?: IPlayer;
  // End turn specific properties
  allPlayersFinished?: boolean;
  destroyedClientPlayers?: DestroyedPlayer[];
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
   * Same logic as old game: find any game that is not started, or the current player is already in
   */
  static async listLobbyGames(options: { sessionId: string }): Promise<any[]> {
    try {
      // Find any game that is not started, or the current player is already in and not destroyed
      const query = {
        $or: [
          { status: "waiting_for_players" }, // Not started games (anyone can join)
          {
            $and: [
              { status: "in_progress" }, // Started but not ended
              {
                players: {
                  $elemMatch: {
                    sessionId: options.sessionId,
                    destroyed: { $ne: true },
                  },
                },
              },
            ],
          },
        ],
      };

      const games = await ServerGameModel.find(query).sort({ lastActivity: -1 }).limit(20);

      // Transform to match old app.js format - clean up docs, don't send sessionId to client
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

      const defaultGameOptions = engine.getDefaultServerGameOptions({});

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
          destroyed: false,
        })),
        gameOptions: defaultGameOptions,
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
      if (game.players && game.players.length >= (game.gameOptions?.systemsToGenerate || 4)) {
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
        destroyed: false,
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
              destroyed: false,
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
          const playerType = mapOpponentTypeToPlayerType(aiLevel);
          enginePlayers.push(
            engine.Player.constructPlayer(
              dbPlayer.Id,
              playerType, // AI difficulty level maps to PlayerType enum
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
        gameSpeed: gameOptions?.gameSpeed || engine.GameSpeed.NORMAL,
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
        gameData: game.gameState as engine.ModelData,
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

  static async changePlayerName(data: { sessionId: string; gameId: string; playerName: string }): Promise<GameResult> {
    try {
      const { sessionId, gameId, playerName } = data;

      if (!playerName || playerName.trim() === "") {
        return { success: false, error: "Player name cannot be empty" };
      }

      // Limit name to 20 characters like the old game
      const trimmedName = playerName.substring(0, 20);

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find the player making the request
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Update the player's name
      player.name = trimmedName;

      // Update the corresponding game options based on player position
      if (player.position === 0) {
        // Host player - update mainPlayerName and hostPlayerName
        game.gameOptions.mainPlayerName = trimmedName;
        game.hostPlayerName = trimmedName;
      } else {
        // Non-host player - update the corresponding opponentOptions entry
        const opponentIndex = player.position - 1;
        if (game.gameOptions.opponentOptions && game.gameOptions.opponentOptions[opponentIndex]) {
          game.gameOptions.opponentOptions[opponentIndex].name = trimmedName;
        }
      }

      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(
        `Player name changed to "${trimmedName}" for player at position ${player.position} in game ${gameId}`,
      );
      return { success: true, game };
    } catch (error) {
      logger.error("Error changing player name:", error);
      return { success: false, error: "Failed to change player name" };
    }
  }

  static async adjustGameSpeed(sessionId: string, payload: any): Promise<GameResult> {
    try {
      if (!payload || typeof payload.newSpeed !== "number") {
        return { success: false, error: "Invalid game speed adjustment request" };
      }

      const { gameId, newSpeed } = payload;

      if (!gameId) {
        return { success: false, error: "Game ID is required" };
      }

      // Validate the speed value using the GameSpeed enum
      if (!Object.values(engine.GameSpeed).includes(newSpeed)) {
        return { success: false, error: "Invalid game speed value" };
      }

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

      // Update the game speed in the game's options
      if (!game.gameOptions) {
        return { success: false, error: "Game options not found" };
      }

      game.gameOptions.gameSpeed = newSpeed;

      // Also update the game speed in the game state model data to keep them in sync
      if (game.gameState && typeof game.gameState === "object" && "gameOptions" in game.gameState) {
        (game.gameState as any).gameOptions.gameSpeed = newSpeed;
      }

      game.lastActivity = new Date();

      // Save the updated game
      await persistGame(game);

      logger.info(`Game speed changed to ${newSpeed} in game ${gameId} by player ${player.name}`);
      return {
        success: true,
        game,
        gameData: game.gameState as engine.ModelData,
      };
    } catch (error) {
      logger.error("Error adjusting game speed:", error);
      return { success: false, error: "Failed to adjust game speed" };
    }
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

  // ==========================================
  // Utility Methods (like old app.js)
  // ==========================================

  /**
   * Converts a game document from the database to a game summary for the frontend
   * This matches the IGame interface expected by the frontend
   * Like the old game, we clean up the docs - we don't need to send everything to the client
   */
  static getGameSummaryFromGameDoc(gameDoc: any): any {
    const summary = {
      _id: gameDoc._id.toString(),
      name: gameDoc.name || "Unnamed Game",
      hostPlayerName: gameDoc.hostPlayerName, // Include host information
      status: gameDoc.status || "waiting",
      players: [] as any[], // Will be populated below without sessionId
      gameOptions: gameDoc.gameOptions || {
        systemsToGenerate: 4,
        planetsPerSystem: 4,
        galaxySize: 4,
        distributePlanetsEvenly: true,
        quickStart: false,
        gameSpeed: 3,
        opponentOptions: [
          { name: "", type: -1 }, // Player 2: Open
          { name: "", type: -2 }, // Player 3: Closed
          { name: "", type: -2 }, // Player 4: Closed
        ],
      },
      createdAt: gameDoc.createdAt,
      lastActivity: gameDoc.lastActivity,
      started: gameDoc.status === "in_progress",
      ended: gameDoc.status === "completed",
    };

    // Clean up player data - only send name and position, NOT sessionId
    // This matches the old game_controller.js logic (line 280-283)
    // Also add 'connected' field based on 'isActive' for frontend compatibility
    if (gameDoc.players) {
      for (const player of gameDoc.players) {
        summary.players.push({
          name: player.name,
          position: player.position,
          connected: player.isActive || false, // Map isActive to connected for frontend
        });
      }
    }

    return summary;
  }

  // ==========================================
  // Command/Event Architecture
  // ==========================================

  /**
   * Core game state update logic that advances time and optionally processes a command.
   * This method is used by both time advancement and command processing paths to avoid duplication.
   *
   * @param gameId - ID of the game
   * @param options - Optional parameters for command processing
   * @returns GameResult with events, destroyed players, and game end conditions
   */
  static async advanceGameStateWithOptionalCommand(
    gameId: string,
    options?: {
      sessionId?: string;
      command?: GameCommand;
    },
  ): Promise<
    GameResult & {
      events?: ClientEvent[];
      currentCycle?: number;
      destroyedPlayers?: engine.PlayerData[];
      gameEndConditions?: engine.GameEndConditions;
    }
  > {
    try {
      // Variables to store results from the transform function
      let allEvents: ClientEvent[] = [];
      let modelData: engine.ModelData | null = null;
      let playerName: string = "";
      let commandError: string | null = null;
      let destroyedPlayers: PlayerData[] = [];
      let gameEndConditions: GameEndConditions = { gameEnded: false, winningPlayer: null, allHumansDestroyed: false };

      // Use concurrency protection to safely update game state
      const updatedGame = await saveGameWithConcurrencyProtection(ServerGameModel, gameId, async (game) => {
        // If a command is being processed, validate the player
        if (options?.command && options?.sessionId) {
          const player = game.players?.find((p) => p.sessionId === options.sessionId);
          if (!player) {
            commandError = "Player not found in game";
            return {}; // No changes
          }
          playerName = player.name;
        }

        if (game.status !== "in_progress") {
          commandError = "Game is not in progress";
          return {}; // No changes
        }

        // STEP 1: Advance game time (always happens)
        const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
        const timeAdvanceResult = advanceGameModelTime(gameModelData);

        // Store time-based events
        const timeBasedEvents = timeAdvanceResult.events || [];
        destroyedPlayers = timeAdvanceResult.destroyedPlayers;
        gameEndConditions = timeAdvanceResult.gameEndConditions;

        // Start with time-based events
        allEvents = [...timeBasedEvents];

        // STEP 2: Process command if provided
        if (options?.command) {
          const commandResult = CommandProcessor.processCommand(gameModelData, options.command);

          if (!commandResult.success) {
            commandError = commandResult.error || "Command processing failed";
            return {}; // No changes
          }

          // Add command events to the list
          const commandEvents = commandResult.events || [];
          allEvents = [...allEvents, ...commandEvents];
        }

        // STEP 3: Calculate and store rolling event checksums for all affected players
        const affectedPlayerIds = new Set<string>();
        for (const event of allEvents) {
          for (const playerId of event.affectedPlayerIds) {
            affectedPlayerIds.add(playerId as string);
          }
        }

        for (const playerId of affectedPlayerIds) {
          const playerEvents = allEvents.filter((e) => e.affectedPlayerIds.includes(playerId));
          const gamePlayer = gameModelData.modelData.players.find((p: PlayerData) => p.id === playerId);
          if (gamePlayer && playerEvents.length > 0) {
            const previousChecksum = gamePlayer.lastEventChecksum || "";
            gamePlayer.lastEventChecksum = calculateRollingEventChecksum(playerEvents, previousChecksum);
          }
        }

        modelData = gameModelData.modelData;

        // Return ONLY the data to update in the database (single atomic save)
        return {
          gameState: gameModelData.modelData,
          lastActivity: new Date(),
          ...(timeAdvanceResult.gameEndConditions.gameEnded && { status: "completed" as const }),
        };
      });

      // Check if there was an error during command processing
      if (commandError) {
        return {
          success: false,
          error: commandError,
        };
      }

      // Log appropriate message
      if (options?.command) {
        logger.info(
          `Processed ${options.command.type} command for player ${playerName} in game ${gameId} (${allEvents.length} total events)`,
        );
      } else {
        logger.info(`Advanced game time for game ${gameId} (${allEvents.length} events generated)`);
      }

      return {
        success: true,
        game: updatedGame,
        gameData: modelData!,
        events: allEvents,
        currentCycle: modelData!.currentCycle || 0,
        destroyedPlayers,
        gameEndConditions,
      };
    } catch (error) {
      const errorContext = options?.command ? `command ${options.command.type}` : "time advancement";
      logger.error(`advanceGameStateWithOptionalCommand error for ${errorContext}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Handle a game command using the new event-driven architecture
   *
   * @param sessionId - Session ID of the player issuing the command
   * @param gameId - ID of the game
   * @param command - The game command to process
   * @returns GameResult with events to broadcast and checksum
   */
  static async handleGameCommand(
    sessionId: string,
    gameId: string,
    command: GameCommand,
  ): Promise<
    GameResult & {
      events?: ClientEvent[];
      currentCycle?: number;
      destroyedPlayers?: engine.PlayerData[];
      gameEndConditions?: engine.GameEndConditions;
    }
  > {
    return this.advanceGameStateWithOptionalCommand(gameId, { sessionId, command });
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
